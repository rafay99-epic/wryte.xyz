/**
 * AI enhancement — mutations and queries.
 *
 * This file runs in the default Convex runtime (NOT Node.js) so it can
 * export mutations and queries. The streaming HTTP action lives in ai_actions.ts.
 */
import { PersistentTextStreaming } from "@convex-dev/persistent-text-streaming";
import { StreamIdValidator } from "@convex-dev/persistent-text-streaming";
import type { StreamId } from "@convex-dev/persistent-text-streaming";
import { v } from "convex/values";
import { components, internal } from "./_generated/api";
import { mutation, query, internalQuery } from "./_generated/server";

/* ------------------------------------------------------------------ */
/*  Streaming instance                                                 */
/* ------------------------------------------------------------------ */

const streaming = new PersistentTextStreaming(
  components.persistentTextStreaming,
);

/* ------------------------------------------------------------------ */
/*  System prompt (exported for UI display)                            */
/* ------------------------------------------------------------------ */

export const ENHANCE_SYSTEM_PROMPT = `You are an expert writing editor. Improve the provided markdown content while preserving the author's voice, intent, and meaning.

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
/*  Mutations & queries                                                */
/* ------------------------------------------------------------------ */

/**
 * Creates a new streaming session for AI enhancement.
 * Authenticates the user, validates AI configuration, and returns
 * a streamId that the client uses with the HTTP streaming endpoint.
 */
export const createEnhanceStream = mutation({
  args: {
    projectId: v.id("projects"),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    // Auth check
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    // Fetch project and verify ownership
    const project = await ctx.db.get(args.projectId);
    if (!project) {
      throw new Error("Project not found");
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_tokenIdentifier", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier),
      )
      .unique();

    if (!user || project.userId !== user._id) {
      throw new Error("Unauthorized: you do not own this project");
    }

    // Validate AI configuration
    if (!project.aiProvider || !project.aiModel) {
      throw new Error(
        "AI is not configured for this project. Go to Project Settings → AI to select a provider and model.",
      );
    }

    // Create the stream
    const streamId = await streaming.createStream(ctx);

    // Schedule the AI enhancement action to run immediately
    await ctx.scheduler.runAfter(
      0,
      internal.ai_actions.runEnhancement,
      {
        streamId,
        provider: project.aiProvider,
        model: project.aiModel,
        content: args.content,
      },
    );

    return {
      streamId,
      provider: project.aiProvider,
      model: project.aiModel,
    };
  },
});

/**
 * Query to retrieve the current stream body (text + status).
 * Used by the useStream React hook for persistent state.
 */
export const getStreamBody = query({
  args: { streamId: StreamIdValidator },
  handler: async (ctx, args) => {
    return await streaming.getStreamBody(ctx, args.streamId as StreamId);
  },
});

/**
 * Creates a streaming session for inline AI enhancement.
 * Processes only the selected text with a custom user instruction.
 */
export const createInlineEnhanceStream = mutation({
  args: {
    projectId: v.id("projects"),
    selectedText: v.string(),
    instruction: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const project = await ctx.db.get(args.projectId);
    if (!project) {
      throw new Error("Project not found");
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_tokenIdentifier", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier),
      )
      .unique();

    if (!user || project.userId !== user._id) {
      throw new Error("Unauthorized: you do not own this project");
    }

    if (!project.aiProvider || !project.aiModel) {
      throw new Error(
        "AI is not configured for this project. Go to Project Settings → AI to select a provider and model.",
      );
    }

    const streamId = await streaming.createStream(ctx);

    await ctx.scheduler.runAfter(
      0,
      internal.ai_actions.runInlineEnhancement,
      {
        streamId,
        provider: project.aiProvider,
        model: project.aiModel,
        selectedText: args.selectedText,
        instruction: args.instruction,
      },
    );

    return {
      streamId,
      provider: project.aiProvider,
      model: project.aiModel,
    };
  },
});

/**
 * Internal query to fetch a project's AI configuration.
 * Used by the HTTP streaming action in ai_actions.ts.
 */
export const getProjectAiConfig = internalQuery({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    const project = await ctx.db.get(args.projectId);
    if (!project) return null;
    return {
      aiProvider: project.aiProvider,
      aiModel: project.aiModel,
    };
  },
});
