"use node";

/**
 * AI enhancement — Node.js action that performs the actual streaming.
 *
 * Reads the provider's API key from WorkOS Vault via the `vaultSecretId`
 * passed in by the calling mutation. There are no `process.env.*_API_KEY`
 * lookups anymore — every project supplies its own key through the
 * `aiCredentials` table.
 */
import Anthropic from "@anthropic-ai/sdk";
import { StreamIdValidator } from "@convex-dev/persistent-text-streaming";
import { v } from "convex/values";
import OpenAI from "openai";
import { components, internal } from "../_generated/api";
import { internalAction } from "../_generated/server";
import { ENHANCE_SYSTEM_PROMPT } from "./enhance";

/* ------------------------------------------------------------------ */
/*  System prompts                                                     */
/* ------------------------------------------------------------------ */

const INLINE_SYSTEM_PROMPT = `You are a writing assistant. Transform the provided text according to the user's instruction.

Rules:
- Apply ONLY the requested transformation
- Return ONLY the transformed text, no commentary or explanation
- Preserve markdown formatting unless the instruction says otherwise
- If the instruction is unclear, make your best interpretation
- Keep the same language unless asked to translate`;

/**
 * System prompt for schema-driven frontmatter suggestions. Field types and
 * a brief expectation are interpolated in below so the model returns one
 * JSON object whose shape exactly matches the project's schema. Fields the
 * author owns (slug, pubDate, draft, hero image) are filtered out before
 * the prompt is built — the model never sees them.
 */
const FRONTMATTER_SYSTEM_PROMPT_PREFIX = `You are an expert SEO and content strategist. Read the provided markdown article and propose values for its frontmatter fields.

Hard rules:
- Return ONE JSON object. No markdown fences, no commentary, nothing outside the object.
- Use the exact field names listed below — case-sensitive.
- Match each value's JSON type to the field's declared type (see "Type reference" below).
- Omit any field where the article gives no clear signal for a useful value. An omitted key is better than a generic invented one.
- Never invent facts that aren't in the article. Don't propose canonical URLs, author info, series numbers, or anything you can't derive from the text itself.
- For string fields, write copy that reads naturally and human. No "Discover the secrets of…" framing, no clickbait, no emoji.
- For tag/keyword arrays, prefer specific multi-word phrases over single generic words. 3–6 items is a healthy range.

Type reference:
- string | text | url     → JSON string
- tags | list | multiselect → JSON array of strings
- boolean                  → JSON true or false
- number                   → JSON number
- select                   → JSON string equal to one of the listed options (case-sensitive)
- color                    → JSON string like "#3b82f6"

Field-specific hints when the schema includes them:
- title       → 50–70 characters, click-worthy without being clickbait
- description → 120–160 characters, meta-description that summarises the value
- excerpt     → 1–2 sentences, max ~200 characters, a teaser that hooks the reader
- keywords    → array of 5–10 SEO phrases — long-tail beats generic`;

const OPENROUTER_HEADERS = {
  "HTTP-Referer": "https://wryte.xyz",
  "X-Title": "Wryte",
} as const;

const PROVIDER_VALIDATOR = v.union(
  v.literal("anthropic"),
  v.literal("openai"),
  v.literal("openrouter"),
);

type ProviderName = "anthropic" | "openai" | "openrouter";

/* ------------------------------------------------------------------ */
/*  Provider adapters                                                  */
/* ------------------------------------------------------------------ */

type ChunkWriter = {
  addChunk(text: string): Promise<void>;
};

async function streamWithAnthropic(
  apiKey: string,
  model: string,
  userContent: string,
  writer: ChunkWriter,
  systemPrompt: string,
): Promise<void> {
  const client = new Anthropic({ apiKey });
  const stream = client.messages.stream({
    model,
    max_tokens: 8192,
    system: systemPrompt,
    messages: [{ role: "user", content: userContent }],
  });

  for await (const event of stream) {
    if (
      event.type === "content_block_delta" &&
      event.delta.type === "text_delta"
    ) {
      await writer.addChunk(event.delta.text);
    }
  }
}

async function streamWithOpenAI(
  apiKey: string,
  model: string,
  userContent: string,
  writer: ChunkWriter,
  systemPrompt: string,
  opts?: { baseURL?: string; extraHeaders?: Record<string, string> },
): Promise<void> {
  const client = new OpenAI({
    apiKey,
    ...(opts?.baseURL ? { baseURL: opts.baseURL } : {}),
    ...(opts?.extraHeaders ? { defaultHeaders: opts.extraHeaders } : {}),
  });

  const stream = await client.chat.completions.create({
    model,
    stream: true,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userContent },
    ],
  });

  for await (const chunk of stream) {
    const text = chunk.choices[0]?.delta?.content;
    if (text) {
      await writer.addChunk(text);
    }
  }
}

/**
 * Dispatch by provider. Wraps the SDK-specific helpers so callers don't
 * have to know what the underlying client looks like.
 */
async function streamByProvider(
  provider: ProviderName,
  apiKey: string,
  model: string,
  userContent: string,
  systemPrompt: string,
  writer: ChunkWriter,
): Promise<void> {
  if (provider === "anthropic") {
    await streamWithAnthropic(apiKey, model, userContent, writer, systemPrompt);
  } else if (provider === "openai") {
    await streamWithOpenAI(apiKey, model, userContent, writer, systemPrompt);
  } else {
    await streamWithOpenAI(apiKey, model, userContent, writer, systemPrompt, {
      baseURL: "https://openrouter.ai/api/v1",
      extraHeaders: OPENROUTER_HEADERS,
    });
  }
}

function hasSentenceDelimiter(text: string): boolean {
  return text.includes(".") || text.includes("!") || text.includes("?");
}

function hasJsonDelimiter(text: string): boolean {
  return text.includes("}") || text.includes(",") || text.includes("]");
}

function describeProviderError(err: unknown, provider: ProviderName): string {
  const e = err as { status?: number; message?: string };
  if (e?.status === 401) {
    return `${provider} rejected the API key. Update it in Project Settings → AI.`;
  }
  if (e?.status === 429) {
    return `${provider} is rate-limiting your requests. Try again in a moment.`;
  }
  if (e?.status !== undefined && e.status >= 500) {
    return `${provider} returned a server error (${e.status}). Try again shortly.`;
  }
  return e?.message ?? "Unknown error";
}

/* ------------------------------------------------------------------ */
/*  Internal action: full-document enhancement                          */
/* ------------------------------------------------------------------ */

export const runEnhancement = internalAction({
  args: {
    streamId: StreamIdValidator,
    provider: PROVIDER_VALIDATOR,
    model: v.string(),
    content: v.string(),
    vaultSecretId: v.string(),
  },
  handler: async (ctx, args) => {
    const apiKey = await ctx.runAction(
      internal.integrations.secretStore._read,
      {
        id: args.vaultSecretId,
      },
    );
    if (!apiKey) {
      throw new Error(
        "API key not found in vault — it may have been deleted during a key rotation. Please try again.",
      );
    }

    const streamId = args.streamId;
    let pending = "";
    const writer = {
      addChunk: async (text: string) => {
        pending += text;
        if (hasSentenceDelimiter(text)) {
          await ctx.runMutation(
            components.persistentTextStreaming.lib.addChunk,
            { streamId, text: pending, final: false },
          );
          pending = "";
        }
      },
    };

    try {
      await streamByProvider(
        args.provider,
        apiKey,
        args.model,
        args.content,
        ENHANCE_SYSTEM_PROMPT,
        writer,
      );

      await ctx.runMutation(components.persistentTextStreaming.lib.addChunk, {
        streamId,
        text: pending,
        final: true,
      });
    } catch (error) {
      const message = describeProviderError(error, args.provider);
      try {
        await ctx.runMutation(
          components.persistentTextStreaming.lib.setStreamStatus,
          { streamId, status: "error" },
        );
      } catch {
        // Stream may already be in a terminal state.
      }
      throw new Error(message);
    }
  },
});

/* ------------------------------------------------------------------ */
/*  Internal action: inline selection transform                         */
/* ------------------------------------------------------------------ */

export const runInlineEnhancement = internalAction({
  args: {
    streamId: StreamIdValidator,
    provider: PROVIDER_VALIDATOR,
    model: v.string(),
    selectedText: v.string(),
    instruction: v.string(),
    vaultSecretId: v.string(),
  },
  handler: async (ctx, args) => {
    const apiKey = await ctx.runAction(
      internal.integrations.secretStore._read,
      {
        id: args.vaultSecretId,
      },
    );
    if (!apiKey) {
      throw new Error(
        "API key not found in vault — it may have been deleted during a key rotation. Please try again.",
      );
    }

    const streamId = args.streamId;
    let pending = "";
    const userMessage = `Instruction: ${args.instruction}\n\nText to transform:\n${args.selectedText}`;

    const writer = {
      addChunk: async (text: string) => {
        pending += text;
        if (hasSentenceDelimiter(text)) {
          await ctx.runMutation(
            components.persistentTextStreaming.lib.addChunk,
            { streamId, text: pending, final: false },
          );
          pending = "";
        }
      },
    };

    try {
      await streamByProvider(
        args.provider,
        apiKey,
        args.model,
        userMessage,
        INLINE_SYSTEM_PROMPT,
        writer,
      );

      await ctx.runMutation(components.persistentTextStreaming.lib.addChunk, {
        streamId,
        text: pending,
        final: true,
      });
    } catch (error) {
      const message = describeProviderError(error, args.provider);
      try {
        await ctx.runMutation(
          components.persistentTextStreaming.lib.setStreamStatus,
          { streamId, status: "error" },
        );
      } catch {
        // Already terminal.
      }
      throw new Error(message);
    }
  },
});

/* ------------------------------------------------------------------ */
/*  Internal action: frontmatter suggestions (JSON output)             */
/* ------------------------------------------------------------------ */

/**
 * Field types the AI is never asked to fill — these are owned by the
 * author or by publish-time side effects. The hero image is a URL the
 * user uploads; dates depend on publish/schedule actions; slug derives
 * from the title.
 */
const AI_EXCLUDED_TYPES = new Set(["image", "date", "datetime", "slug"]);

/**
 * Field names that are publish-lifecycle controls, not metadata the
 * author writes. These never go to the AI even when the schema mis-types
 * them (e.g., draft stored as a string).
 */
const AI_EXCLUDED_NAMES = new Set([
  "draft",
  "pubDate",
  "publishDate",
  "date",
  "slug",
  "publishedAt",
  "updatedAt",
]);

type SchemaField = {
  name: string;
  type: string;
  label?: string;
  description?: string;
  options?: string;
  hidden?: boolean;
};

/**
 * Filters the project's frontmatter schema down to the fields the AI is
 * allowed to propose values for, then formats them as a compact prompt
 * fragment listing each field's name, type, optional description, and
 * (for select fields) its allowed options.
 */
function buildSchemaPromptFragment(schemaJson: string): {
  fragment: string;
  eligibleNames: string[];
} {
  if (!schemaJson) return { fragment: "", eligibleNames: [] };
  let parsed: SchemaField[];
  try {
    parsed = JSON.parse(schemaJson) as SchemaField[];
  } catch {
    return { fragment: "", eligibleNames: [] };
  }
  if (!Array.isArray(parsed)) return { fragment: "", eligibleNames: [] };

  const eligible = parsed.filter(
    (f) =>
      !!f.name &&
      !!f.type &&
      !f.hidden &&
      !AI_EXCLUDED_TYPES.has(f.type) &&
      !AI_EXCLUDED_NAMES.has(f.name),
  );

  if (eligible.length === 0) return { fragment: "", eligibleNames: [] };

  const lines = eligible.map((f) => {
    const bits: string[] = [`- "${f.name}" (${f.type})`];
    if (f.label && f.label !== f.name) bits.push(`labelled "${f.label}"`);
    if (f.description) bits.push(`— ${f.description}`);
    if (f.type === "select" && f.options) {
      const opts = f.options
        .split(",")
        .map((o) => o.trim())
        .filter(Boolean);
      if (opts.length > 0) bits.push(`(one of: ${opts.join(", ")})`);
    }
    return bits.join(" ");
  });

  return {
    fragment: `\n\nFields to propose values for:\n${lines.join("\n")}`,
    eligibleNames: eligible.map((f) => f.name),
  };
}

export const runFrontmatterSuggestion = internalAction({
  args: {
    streamId: StreamIdValidator,
    provider: PROVIDER_VALIDATOR,
    model: v.string(),
    content: v.string(),
    frontmatterSchema: v.string(),
    currentFrontmatter: v.string(),
    vaultSecretId: v.string(),
  },
  handler: async (ctx, args) => {
    const apiKey = await ctx.runAction(
      internal.integrations.secretStore._read,
      {
        id: args.vaultSecretId,
      },
    );
    if (!apiKey) {
      throw new Error(
        "API key not found in vault — it may have been deleted during a key rotation. Please try again.",
      );
    }

    const streamId = args.streamId;
    let pending = "";

    const { fragment, eligibleNames } = buildSchemaPromptFragment(
      args.frontmatterSchema,
    );

    if (eligibleNames.length === 0) {
      // No AI-eligible fields — short-circuit with an empty object so the
      // drawer can show a friendly "nothing to suggest" state instead of
      // making a paid call that returns nothing useful.
      await ctx.runMutation(components.persistentTextStreaming.lib.addChunk, {
        streamId,
        text: "{}",
        final: true,
      });
      return;
    }

    const systemPrompt = `${FRONTMATTER_SYSTEM_PROMPT_PREFIX}${fragment}`;

    // Trim current frontmatter to just the AI-eligible fields so we don't
    // spend tokens on slug, draft, dates, etc. that the model isn't
    // allowed to touch anyway.
    let currentForPrompt = "";
    if (args.currentFrontmatter) {
      try {
        const parsed = JSON.parse(args.currentFrontmatter) as Record<
          string,
          unknown
        >;
        const eligibleSet = new Set(eligibleNames);
        const trimmed: Record<string, unknown> = {};
        for (const [k, val] of Object.entries(parsed)) {
          if (eligibleSet.has(k) && val !== "" && val != null) {
            trimmed[k] = val;
          }
        }
        if (Object.keys(trimmed).length > 0) {
          currentForPrompt = `\n\nValues the author already wrote (avoid trivial paraphrases):\n${JSON.stringify(
            trimmed,
            null,
            2,
          )}`;
        }
      } catch {
        // Ignore malformed current frontmatter — the model can still
        // propose from the article alone.
      }
    }

    const userMessage = `Article:\n${args.content}${currentForPrompt}`;

    const writer = {
      addChunk: async (text: string) => {
        pending += text;
        // JSON output: flush on closing braces/commas/brackets so the UI
        // can render the response as it arrives without waiting for the
        // entire object to be parsed.
        if (hasJsonDelimiter(text)) {
          await ctx.runMutation(
            components.persistentTextStreaming.lib.addChunk,
            { streamId, text: pending, final: false },
          );
          pending = "";
        }
      },
    };

    try {
      await streamByProvider(
        args.provider,
        apiKey,
        args.model,
        userMessage,
        systemPrompt,
        writer,
      );

      await ctx.runMutation(components.persistentTextStreaming.lib.addChunk, {
        streamId,
        text: pending,
        final: true,
      });
    } catch (error) {
      const message = describeProviderError(error, args.provider);
      try {
        await ctx.runMutation(
          components.persistentTextStreaming.lib.setStreamStatus,
          { streamId, status: "error" },
        );
      } catch {
        // Already terminal.
      }
      throw new Error(message);
    }
  },
});
