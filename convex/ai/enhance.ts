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

export const FINAL_DRAFT_SYSTEM_PROMPT = `You are an expert long-form blog editor. Turn the provided working article, draft snapshots, and research notes into a polished final markdown draft.

Guidelines:
- Use the research and prior drafts as context, not as text to dump verbatim
- Preserve the author's voice and the article's intended angle
- Resolve contradictions by favoring the current article unless research clearly improves it
- Keep markdown formatting clean and publish-ready
- Do not invent facts beyond the provided context
- Do not include commentary, explanations, or meta-text
- Return ONLY the final markdown article`;

const MDX_ADDENDUM = `\n- Preserve all JSX/MDX component syntax (<Component prop="value" />, {expressions}, import/export statements). Do not modify, remove, or reformat JSX tags or expressions.`;

export function getEnhanceSystemPrompt(contentFormat?: string): string {
  return contentFormat === "mdx"
    ? ENHANCE_SYSTEM_PROMPT + MDX_ADDENDUM
    : ENHANCE_SYSTEM_PROMPT;
}

export function getFinalDraftSystemPrompt(contentFormat?: string): string {
  return contentFormat === "mdx"
    ? FINAL_DRAFT_SYSTEM_PROMPT + MDX_ADDENDUM
    : FINAL_DRAFT_SYSTEM_PROMPT;
}

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
  if (credential.status === "verifying") {
    throw new Error(
      "The API key is still being verified. Please wait a moment and try again.",
    );
  }
  if (credential.status === "rotating") {
    throw new Error(
      "The API key is currently being rotated. Please wait a moment and try again.",
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

/**
 * Records who owns the stream so `getStreamBody` can reject reads from
 * other users. Called immediately after every `streaming.createStream`.
 */
async function trackStreamOwner(
  ctx: MutationCtx,
  streamId: string,
  userId: Doc<"users">["_id"],
  projectId: Doc<"projects">["_id"],
): Promise<void> {
  await ctx.db.insert("ai_stream_owners", {
    streamId,
    userId,
    projectId,
    createdAt: Date.now(),
  });
}

export const createEnhanceStream = mutation({
  args: {
    projectId: v.id("projects"),
    content: v.string(),
    systemPrompt: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const key = await getRateLimitKey(ctx);
    await rateLimiter.limit(ctx, "ai:createEnhanceStream", {
      key,
      throws: true,
    });

    const user = await getCurrentUser(ctx);
    const { project, provider, model, vaultSecretId } =
      await resolveProjectAndCredential(ctx, args.projectId);

    const streamId = await streaming.createStream(ctx);
    await trackStreamOwner(ctx, streamId, user._id, project._id);

    await ctx.scheduler.runAfter(0, internal.ai.enhanceActions.runEnhancement, {
      streamId,
      provider,
      model,
      content: args.content,
      vaultSecretId,
      ...(project.contentFormat
        ? { contentFormat: project.contentFormat }
        : {}),
      ...(args.systemPrompt ? { systemPrompt: args.systemPrompt } : {}),
    });

    return { streamId, provider, model };
  },
});

/** Reactive query the client uses to render the streamed AI response. */
export const getStreamBody = query({
  args: { streamId: StreamIdValidator },
  handler: async (ctx, args) => {
    const user = await getAuthedUserOrNull(ctx);
    if (!user) return null;

    const streamIdStr = args.streamId as string;
    const owner = await ctx.db
      .query("ai_stream_owners")
      .withIndex("by_streamId", (q) => q.eq("streamId", streamIdStr))
      .unique();
    if (!owner || owner.userId !== user._id) return null;

    return await streaming.getStreamBody(ctx, args.streamId as StreamId);
  },
});

export const createInlineEnhanceStream = mutation({
  args: {
    projectId: v.id("projects"),
    selectedText: v.string(),
    instruction: v.string(),
    systemPrompt: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const key = await getRateLimitKey(ctx);
    await rateLimiter.limit(ctx, "ai:createInlineEnhanceStream", {
      key,
      throws: true,
    });

    const user = await getCurrentUser(ctx);
    const { project, provider, model, vaultSecretId } =
      await resolveProjectAndCredential(ctx, args.projectId);

    const streamId = await streaming.createStream(ctx);
    await trackStreamOwner(ctx, streamId, user._id, project._id);

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
        ...(project.contentFormat
          ? { contentFormat: project.contentFormat }
          : {}),
        ...(args.systemPrompt ? { systemPrompt: args.systemPrompt } : {}),
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

    const user = await getCurrentUser(ctx);
    const { project, provider, model, vaultSecretId } =
      await resolveProjectAndCredential(ctx, args.projectId);

    const streamId = await streaming.createStream(ctx);
    await trackStreamOwner(ctx, streamId, user._id, project._id);

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

export const createFinalDraftStream = mutation({
  args: {
    projectId: v.id("projects"),
    documentId: v.id("documents"),
    content: v.string(),
    title: v.optional(v.string()),
    draftIds: v.optional(v.array(v.id("document_drafts"))),
    researchIds: v.optional(v.array(v.id("document_research"))),
    systemPrompt: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const key = await getRateLimitKey(ctx);
    await rateLimiter.limit(ctx, "ai:createFinalDraftStream", {
      key,
      throws: true,
    });

    const user = await getCurrentUser(ctx);
    const {
      project: aiProject,
      provider,
      model,
      vaultSecretId,
    } = await resolveProjectAndCredential(ctx, args.projectId);
    const document = await ctx.db.get(args.documentId);
    if (
      !document ||
      document.projectId !== args.projectId ||
      document.userId !== user._id ||
      document.trashedAt !== undefined
    ) {
      throw new Error("Document not found");
    }

    const requestedDraftIds = (args.draftIds ?? []).slice(0, 5);
    const requestedResearchIds = (args.researchIds ?? []).slice(0, 12);

    const drafts = (
      await Promise.all(requestedDraftIds.map((id) => ctx.db.get(id)))
    ).filter(
      (draft): draft is Doc<"document_drafts"> =>
        !!draft &&
        draft.documentId === args.documentId &&
        draft.userId === user._id,
    );

    const research = (
      await Promise.all(requestedResearchIds.map((id) => ctx.db.get(id)))
    ).filter(
      (item): item is Doc<"document_research"> =>
        !!item &&
        item.documentId === args.documentId &&
        item.userId === user._id,
    );

    const streamId = await streaming.createStream(ctx);
    await trackStreamOwner(ctx, streamId, user._id, aiProject._id);

    await ctx.scheduler.runAfter(0, internal.ai.enhanceActions.runFinalDraft, {
      streamId,
      provider,
      model,
      vaultSecretId,
      title: args.title ?? document.title,
      currentContent: args.content,
      ...(aiProject.contentFormat
        ? { contentFormat: aiProject.contentFormat }
        : {}),
      ...(args.systemPrompt ? { systemPrompt: args.systemPrompt } : {}),
      drafts: drafts.map((draft) => ({
        label: draft.label,
        title: draft.titleSnapshot,
        ...(draft.summary !== undefined ? { summary: draft.summary } : {}),
        content: draft.contentSnapshot.slice(0, 6000),
      })),
      research: research.map((item) => ({
        type: item.type,
        title: item.title,
        ...(item.sourceName !== undefined
          ? { sourceName: item.sourceName }
          : {}),
        ...(item.url !== undefined ? { url: item.url } : {}),
        content: item.content.slice(0, 3000),
      })),
    });

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
