/**
 * Non-Node database helpers for syndication outcomes.
 *
 * One row per (document, provider) — upserted, not appended — so the row
 * count stays bounded and `remoteId` doubles as the idempotency key: a
 * re-publish with a remoteId on file updates the remote post instead of
 * creating a duplicate. Rows hold ids/urls/errors only, never the body.
 */
import { v } from "convex/values";
import { internalMutation, internalQuery, query } from "../_generated/server";
import { getAuthedUserOrNull } from "../_lib/auth";
import { syndicationProviderValidator } from "./_lib/providers";

const STATUS_VALIDATOR = v.union(
  v.literal("pending"),
  v.literal("posted"),
  v.literal("failed"),
);

const POST_DOC = v.object({
  _id: v.id("syndication_posts"),
  _creationTime: v.number(),
  projectId: v.id("projects"),
  documentId: v.id("documents"),
  provider: syndicationProviderValidator,
  status: STATUS_VALIDATOR,
  remoteId: v.optional(v.string()),
  remoteUrl: v.optional(v.string()),
  errorCode: v.optional(v.string()),
  errorMessage: v.optional(v.string()),
  attempt: v.number(),
  createdAt: v.number(),
  updatedAt: v.number(),
});

/** Cross-post status rows for a document (settings + publish dialog). */
export const listForDocument = query({
  args: { documentId: v.id("documents") },
  returns: v.array(POST_DOC),
  handler: async (ctx, args) => {
    const user = await getAuthedUserOrNull(ctx);
    if (!user) return [];
    const document = await ctx.db.get(args.documentId);
    if (!document || document.userId !== user._id) return [];

    return await ctx.db
      .query("syndication_posts")
      .withIndex("by_documentId", (q) => q.eq("documentId", args.documentId))
      .take(10);
  },
});

export const _get = internalQuery({
  args: { syndicationPostId: v.id("syndication_posts") },
  returns: v.union(v.null(), POST_DOC),
  handler: async (ctx, args) => ctx.db.get(args.syndicationPostId),
});

export const _findByDocumentAndProvider = internalQuery({
  args: {
    documentId: v.id("documents"),
    provider: syndicationProviderValidator,
  },
  returns: v.union(v.null(), POST_DOC),
  handler: async (ctx, args) => {
    return await ctx.db
      .query("syndication_posts")
      .withIndex("by_documentId_and_provider", (q) =>
        q.eq("documentId", args.documentId).eq("provider", args.provider),
      )
      .unique();
  },
});

/**
 * Upsert the single (document, provider) row. `remoteId`/`remoteUrl` are
 * only ever added, never cleared implicitly — a failed update attempt must
 * not lose the id that makes the next attempt idempotent. Pass
 * `clearRemote: true` for the one legitimate case (remote post deleted).
 */
export const _upsert = internalMutation({
  args: {
    projectId: v.id("projects"),
    documentId: v.id("documents"),
    provider: syndicationProviderValidator,
    status: STATUS_VALIDATOR,
    remoteId: v.optional(v.string()),
    remoteUrl: v.optional(v.string()),
    errorCode: v.optional(v.string()),
    errorMessage: v.optional(v.string()),
    attempt: v.number(),
    clearRemote: v.optional(v.boolean()),
  },
  returns: v.id("syndication_posts"),
  handler: async (ctx, args) => {
    const now = Date.now();
    const existing = await ctx.db
      .query("syndication_posts")
      .withIndex("by_documentId_and_provider", (q) =>
        q.eq("documentId", args.documentId).eq("provider", args.provider),
      )
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        status: args.status,
        attempt: args.attempt,
        updatedAt: now,
        // `undefined` removes the field — success clears the prior error.
        errorCode: args.errorCode,
        errorMessage: args.errorMessage,
        ...(args.clearRemote
          ? { remoteId: undefined, remoteUrl: undefined }
          : {
              ...(args.remoteId !== undefined
                ? { remoteId: args.remoteId }
                : {}),
              ...(args.remoteUrl !== undefined
                ? { remoteUrl: args.remoteUrl }
                : {}),
            }),
      });
      return existing._id;
    }

    return await ctx.db.insert("syndication_posts", {
      projectId: args.projectId,
      documentId: args.documentId,
      provider: args.provider,
      status: args.status,
      ...(args.remoteId !== undefined ? { remoteId: args.remoteId } : {}),
      ...(args.remoteUrl !== undefined ? { remoteUrl: args.remoteUrl } : {}),
      ...(args.errorCode !== undefined ? { errorCode: args.errorCode } : {}),
      ...(args.errorMessage !== undefined
        ? { errorMessage: args.errorMessage }
        : {}),
      attempt: args.attempt,
      createdAt: now,
      updatedAt: now,
    });
  },
});
