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

/* ------------------------------------------------------------------ */
/*  System prompts                                                     */
/* ------------------------------------------------------------------ */

const ENHANCE_SYSTEM_PROMPT = `You are an expert writing editor. Improve the provided markdown content while preserving the author's voice, intent, and meaning.

Guidelines:
- Fix grammar, spelling, and punctuation errors
- Improve sentence structure and flow
- Enhance clarity and readability
- Maintain the original tone and style
- Preserve all markdown formatting (headings, links, lists, code blocks, etc.)
- Do not add new sections or substantially change the content's meaning
- Do not add commentary, explanations, or meta-text
- Return ONLY the improved markdown content, nothing else
- If the content is already well-written, make minimal changes`;

const INLINE_SYSTEM_PROMPT = `You are a writing assistant. Transform the provided text according to the user's instruction.

Rules:
- Apply ONLY the requested transformation
- Return ONLY the transformed text, no commentary or explanation
- Preserve markdown formatting unless the instruction says otherwise
- If the instruction is unclear, make your best interpretation
- Keep the same language unless asked to translate`;

const FRONTMATTER_SYSTEM_PROMPT = `You are an expert SEO and content strategist. Analyse the provided markdown article and suggest frontmatter metadata that maximises discoverability and reader engagement.

Return ONLY valid JSON (no markdown fences, no explanation) with these keys:
- "title": a compelling, SEO-friendly title (50-70 characters ideal)
- "description": a meta-description optimised for search (120-160 characters)
- "tags": an array of 3-6 relevant topic tags (lowercase, single words or short phrases)
- "keywords": a comma-separated string of 5-10 SEO keywords/phrases
- "excerpt": a 1-2 sentence teaser that hooks the reader (max 200 characters)

Guidelines:
- Base suggestions on the actual content, not guesses
- Prefer specific, long-tail keywords over generic ones
- Tags should reflect the article's main topics
- The title should be click-worthy but not clickbait
- The description should summarise the value proposition for searchers
- If the content is short or empty, do your best with what's available
- Only return keys listed above — no extra fields`;

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
    const apiKey: string = await ctx.runAction(
      internal.integrations.secretStore._read,
      {
        id: args.vaultSecretId,
      },
    );

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
    const apiKey: string = await ctx.runAction(
      internal.integrations.secretStore._read,
      {
        id: args.vaultSecretId,
      },
    );

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
    const apiKey: string = await ctx.runAction(
      internal.integrations.secretStore._read,
      {
        id: args.vaultSecretId,
      },
    );

    const streamId = args.streamId;
    let pending = "";

    const schemaContext = args.frontmatterSchema
      ? `\nProject schema fields: ${args.frontmatterSchema}`
      : "";
    const currentContext = args.currentFrontmatter
      ? `\nCurrent frontmatter: ${args.currentFrontmatter}`
      : "";
    const userMessage = `Analyse this article and suggest frontmatter metadata.${schemaContext}${currentContext}\n\nArticle content:\n${args.content}`;

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
        FRONTMATTER_SYSTEM_PROMPT,
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
