/**
 * AI enhancement — mutations and queries.
 *
 * Runs in the default Convex runtime (NOT Node.js). All actual provider
 * streaming lives in `enhanceActions.ts`. Mutations here resolve the project's
 * configured AI credential row, hand the `vaultSecretId` to the scheduled
 * action, and short-circuit with a friendly error if anything's missing.
 */

import type { StreamId } from "@convex-dev/persistent-text-streaming";
import {
  PersistentTextStreaming,
  StreamIdValidator,
} from "@convex-dev/persistent-text-streaming";
import { v } from "convex/values";
import { components, internal } from "../_generated/api";
import type { Doc } from "../_generated/dataModel";
import {
  internalQuery,
  type MutationCtx,
  mutation,
  query,
} from "../_generated/server";
import { getAuthedUserOrNull, getCurrentUser } from "../_lib/auth";
import { getRateLimitKey, rateLimiter } from "../_lib/rateLimits";

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
/*  Shared resolver: auth + project + credential                        */
/* ------------------------------------------------------------------ */

/**
 * Centralised guard for every AI mutation:
 *  - asserts the caller owns the project
 *  - confirms `aiProvider` / `aiModel` are configured
 *  - confirms a credential row exists for that provider with `status === "active"`
 *
 * Throws friendly errors that the client renders directly.
 */
async function resolveProjectAndCredential(
  ctx: MutationCtx,
  projectId: Doc<"projects">["_id"],
): Promise<{
  project: Doc<"projects">;
  provider: "anthropic" | "openai" | "openrouter";
  model: string;
  vaultSecretId: string;
}> {
  const user = await getCurrentUser(ctx);

  const project = await ctx.db.get(projectId);
  if (!project) {
    throw new Error("Project not found");
  }

  if (project.userId !== user._id) {
    throw new Error("Unauthorized: you do not own this project");
  }

  const provider = project.aiProvider;
  const model = project.aiModel;
  if (!provider || !model) {
    throw new Error(
      "AI is not configured for this project. Go to Project Settings → AI to pick a provider and model.",
    );
  }

  const credential = await ctx.db
    .query("aiCredentials")
    .withIndex("by_projectId_and_provider", (q) =>
      q.eq("projectId", projectId).eq("provider", provider),
    )
    .unique();

  if (!credential) {
    throw new Error(
      "No API key saved for the selected provider. Open Project Settings → AI to add your key.",
    );
  }
  if (credential.status === "invalid") {
    throw new Error(
      "The saved API key was rejected by the provider. Rotate it in Project Settings → AI.",
    );
  }

  return {
    project,
    provider,
    model,
    vaultSecretId: credential.vaultSecretId,
  };
}

/* ------------------------------------------------------------------ */
/*  Mutations & queries                                                */
/* ------------------------------------------------------------------ */

export const createEnhanceStream = mutation({
  args: {
    projectId: v.id("projects"),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    const key = await getRateLimitKey(ctx);
    await rateLimiter.limit(ctx, "ai:createEnhanceStream", {
      key,
      throws: true,
    });

    const { provider, model, vaultSecretId } =
      await resolveProjectAndCredential(ctx, args.projectId);

    const streamId = await streaming.createStream(ctx);

    await ctx.scheduler.runAfter(0, internal.ai.enhanceActions.runEnhancement, {
      streamId,
      provider,
      model,
      content: args.content,
      vaultSecretId,
    });

    return { streamId, provider, model };
  },
});

/** Reactive query the client uses to render the streamed AI response. */
export const getStreamBody = query({
  args: { streamId: StreamIdValidator },
  handler: async (ctx, args) => {
    return await streaming.getStreamBody(ctx, args.streamId as StreamId);
  },
});

export const createInlineEnhanceStream = mutation({
  args: {
    projectId: v.id("projects"),
    selectedText: v.string(),
    instruction: v.string(),
  },
  handler: async (ctx, args) => {
    const key = await getRateLimitKey(ctx);
    await rateLimiter.limit(ctx, "ai:createInlineEnhanceStream", {
      key,
      throws: true,
    });

    const { provider, model, vaultSecretId } =
      await resolveProjectAndCredential(ctx, args.projectId);

    const streamId = await streaming.createStream(ctx);

    await ctx.scheduler.runAfter(
      0,
      internal.ai.enhanceActions.runInlineEnhancement,
      {
        streamId,
        provider,
        model,
        selectedText: args.selectedText,
        instruction: args.instruction,
        vaultSecretId,
      },
    );

    return { streamId, provider, model };
  },
});

export const createFrontmatterStream = mutation({
  args: {
    projectId: v.id("projects"),
    content: v.string(),
    currentFrontmatter: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const key = await getRateLimitKey(ctx);
    await rateLimiter.limit(ctx, "ai:createFrontmatterStream", {
      key,
      throws: true,
    });

    const { project, provider, model, vaultSecretId } =
      await resolveProjectAndCredential(ctx, args.projectId);

    const streamId = await streaming.createStream(ctx);

    await ctx.scheduler.runAfter(
      0,
      internal.ai.enhanceActions.runFrontmatterSuggestion,
      {
        streamId,
        provider,
        model,
        content: args.content,
        frontmatterSchema: project.frontmatterSchema ?? "",
        currentFrontmatter: args.currentFrontmatter ?? "",
        vaultSecretId,
      },
    );

    return { streamId, provider, model };
  },
});

/**
 * Public readiness probe used by the editor to gate AI surface area.
 *
 * Returns `ready: true` only when a project has a provider + model picked
 * AND a credential row exists in `active` status. Anything short of that
 * gives a typed `reason` the UI can use to render the right CTA.
 *
 * Designed to be cheap — every editor render reads it.
 */
export const isAiReady = query({
  args: { projectId: v.id("projects") },
  handler: async (
    ctx,
    args,
  ): Promise<{
    ready: boolean;
    reason?:
      | "unauthorized"
      | "no-provider"
      | "no-model"
      | "no-credential"
      | "verifying"
      | "invalid"
      | "rotating";
    provider?: "anthropic" | "openai" | "openrouter";
    model?: string;
  }> => {
    const user = await getAuthedUserOrNull(ctx);
    if (!user) return { ready: false, reason: "unauthorized" };

    const project = await ctx.db.get(args.projectId);
    if (!project || project.userId !== user._id) {
      return { ready: false, reason: "unauthorized" };
    }

    const provider = project.aiProvider;
    const model = project.aiModel;
    if (!provider) return { ready: false, reason: "no-provider" };
    if (!model) return { ready: false, reason: "no-model", provider };

    const cred = await ctx.db
      .query("aiCredentials")
      .withIndex("by_projectId_and_provider", (q) =>
        q.eq("projectId", args.projectId).eq("provider", provider),
      )
      .unique();

    if (!cred) return { ready: false, reason: "no-credential", provider };
    if (cred.status === "invalid") {
      return { ready: false, reason: "invalid", provider, model };
    }
    if (cred.status === "verifying") {
      return { ready: false, reason: "verifying", provider, model };
    }
    if (cred.status === "rotating") {
      return { ready: false, reason: "rotating", provider, model };
    }
    return { ready: true, provider, model };
  },
});

/**
 * Internal query to fetch a project's AI configuration. Kept for any
 * legacy HTTP-action path that might still call it; new code should go
 * through `resolveProjectAndCredential` above.
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
