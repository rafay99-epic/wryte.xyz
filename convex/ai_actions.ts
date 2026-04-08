"use node";

/**
 * AI enhancement — Node.js action that performs the actual streaming.
 *
 * This file uses "use node" for external AI SDK access.
 * It exports an internalAction that writes chunks to a PersistentTextStreaming stream.
 */
import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { StreamIdValidator } from "@convex-dev/persistent-text-streaming";
import { v } from "convex/values";
import { components } from "./_generated/api";
import { internalAction } from "./_generated/server";

/* ------------------------------------------------------------------ */
/*  System prompt                                                      */
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

/* ------------------------------------------------------------------ */
/*  Provider adapters                                                  */
/* ------------------------------------------------------------------ */

type ChunkWriter = {
  addChunk(text: string): Promise<void>;
};

async function streamWithAnthropic(
  model: string,
  content: string,
  writer: ChunkWriter,
  systemPrompt?: string,
): Promise<void> {
  const apiKey = process.env["ANTHROPIC_API_KEY"];
  if (!apiKey) {
    throw new Error(
      "ANTHROPIC_API_KEY is not configured. Add it in the Convex dashboard.",
    );
  }

  const client = new Anthropic({ apiKey });

  const stream = client.messages.stream({
    model,
    max_tokens: 8192,
    system: systemPrompt ?? ENHANCE_SYSTEM_PROMPT,
    messages: [{ role: "user", content }],
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
  model: string,
  content: string,
  writer: ChunkWriter,
  options?: {
    baseURL?: string;
    apiKeyEnvVar?: string;
    extraHeaders?: Record<string, string>;
    systemPrompt?: string;
  },
): Promise<void> {
  const envVar = options?.apiKeyEnvVar ?? "OPENAI_API_KEY";
  const apiKey = process.env[envVar];
  if (!apiKey) {
    throw new Error(
      `${envVar} is not configured. Add it in the Convex dashboard.`,
    );
  }

  const client = new OpenAI({
    apiKey,
    ...(options?.baseURL ? { baseURL: options.baseURL } : {}),
    ...(options?.extraHeaders
      ? { defaultHeaders: options.extraHeaders }
      : {}),
  });

  const stream = await client.chat.completions.create({
    model,
    stream: true,
    messages: [
      { role: "system", content: options?.systemPrompt ?? ENHANCE_SYSTEM_PROMPT },
      { role: "user", content },
    ],
  });

  for await (const chunk of stream) {
    const text = chunk.choices[0]?.delta?.content;
    if (text) {
      await writer.addChunk(text);
    }
  }
}

/* ------------------------------------------------------------------ */
/*  Helpers: directly call component mutations (addChunk/setStreamStatus
 *  are private on the PersistentTextStreaming class, so we call the
 *  underlying component mutations directly from the action context). */
/* ------------------------------------------------------------------ */

function hasDelimiter(text: string) {
  return text.includes(".") || text.includes("!") || text.includes("?");
}

/* ------------------------------------------------------------------ */
/*  Internal action: runs the AI enhancement and writes chunks         */
/* ------------------------------------------------------------------ */

/**
 * Internal action that calls the AI provider's streaming API and writes
 * chunks to the persistent text stream. Called by the mutation after
 * creating the stream, scheduled to run immediately.
 */
export const runEnhancement = internalAction({
  args: {
    streamId: StreamIdValidator,
    provider: v.union(
      v.literal("anthropic"),
      v.literal("openai"),
      v.literal("openrouter"),
    ),
    model: v.string(),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    const streamId = args.streamId;
    let pending = "";

    const writer = {
      addChunk: async (text: string) => {
        pending += text;
        // Batch writes at sentence boundaries to reduce mutation calls
        if (hasDelimiter(text)) {
          await ctx.runMutation(
            components.persistentTextStreaming.lib.addChunk,
            { streamId, text: pending, final: false },
          );
          pending = "";
        }
      },
    };

    try {
      switch (args.provider) {
        case "anthropic":
          await streamWithAnthropic(args.model, args.content, writer);
          break;
        case "openai":
          await streamWithOpenAI(args.model, args.content, writer);
          break;
        case "openrouter":
          await streamWithOpenAI(args.model, args.content, writer, {
            baseURL: "https://openrouter.ai/api/v1",
            apiKeyEnvVar: "OPENROUTER_API_KEY",
            extraHeaders: {
              "HTTP-Referer": "https://wryte.xyz",
              "X-Title": "Wryte",
            },
          });
          break;
      }

      // Flush remaining text and mark stream as complete
      await ctx.runMutation(
        components.persistentTextStreaming.lib.addChunk,
        { streamId, text: pending, final: true },
      );
    } catch (error: unknown) {
      const err = error as { status?: number; message?: string };
      let message = err.message ?? "Unknown error";

      if (err.status === 401) {
        message = `Invalid API key for ${args.provider}. Check your Convex environment variables.`;
      } else if (err.status === 429) {
        message = `Rate limited by ${args.provider}. Please try again in a moment.`;
      }

      // Set stream to error state
      try {
        await ctx.runMutation(
          components.persistentTextStreaming.lib.setStreamStatus,
          { streamId, status: "error" },
        );
      } catch {
        // Stream may already be in terminal state
      }
      throw new Error(message);
    }
  },
});

/* ------------------------------------------------------------------ */
/*  Inline enhancement: selected text + custom user instruction        */
/* ------------------------------------------------------------------ */

const INLINE_SYSTEM_PROMPT = `You are a writing assistant. Transform the provided text according to the user's instruction.

Rules:
- Apply ONLY the requested transformation
- Return ONLY the transformed text, no commentary or explanation
- Preserve markdown formatting unless the instruction says otherwise
- If the instruction is unclear, make your best interpretation
- Keep the same language unless asked to translate`;

export const runInlineEnhancement = internalAction({
  args: {
    streamId: StreamIdValidator,
    provider: v.union(
      v.literal("anthropic"),
      v.literal("openai"),
      v.literal("openrouter"),
    ),
    model: v.string(),
    selectedText: v.string(),
    instruction: v.string(),
  },
  handler: async (ctx, args) => {
    const streamId = args.streamId;
    let pending = "";

    const userMessage = `Instruction: ${args.instruction}\n\nText to transform:\n${args.selectedText}`;

    const writer = {
      addChunk: async (text: string) => {
        pending += text;
        if (hasDelimiter(text)) {
          await ctx.runMutation(
            components.persistentTextStreaming.lib.addChunk,
            { streamId, text: pending, final: false },
          );
          pending = "";
        }
      },
    };

    try {
      switch (args.provider) {
        case "anthropic":
          await streamWithAnthropic(
            args.model,
            userMessage,
            writer,
            INLINE_SYSTEM_PROMPT,
          );
          break;
        case "openai":
          await streamWithOpenAI(
            args.model,
            userMessage,
            writer,
            { systemPrompt: INLINE_SYSTEM_PROMPT },
          );
          break;
        case "openrouter":
          await streamWithOpenAI(
            args.model,
            userMessage,
            writer,
            {
              baseURL: "https://openrouter.ai/api/v1",
              apiKeyEnvVar: "OPENROUTER_API_KEY",
              extraHeaders: {
                "HTTP-Referer": "https://wryte.xyz",
                "X-Title": "Wryte",
              },
              systemPrompt: INLINE_SYSTEM_PROMPT,
            },
          );
          break;
      }

      await ctx.runMutation(
        components.persistentTextStreaming.lib.addChunk,
        { streamId, text: pending, final: true },
      );
    } catch (error: unknown) {
      const err = error as { status?: number; message?: string };
      let message = err.message ?? "Unknown error";

      if (err.status === 401) {
        message = `Invalid API key for ${args.provider}. Check your Convex environment variables.`;
      } else if (err.status === 429) {
        message = `Rate limited by ${args.provider}. Please try again in a moment.`;
      }

      try {
        await ctx.runMutation(
          components.persistentTextStreaming.lib.setStreamStatus,
          { streamId, status: "error" },
        );
      } catch {
        // Stream may already be in terminal state
      }
      throw new Error(message);
    }
  },
});
