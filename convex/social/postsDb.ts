/**
 * Non-Node database helpers for social announcement outcomes.
 *
 * Rows are written once per publish (batched — one mutation regardless of
 * channel count) and read only while the publish dialog is open, so the
 * table adds zero standing Convex cost.
 */
import { v } from "convex/values";
import { internalMutation, internalQuery, query } from "../_generated/server";
import { getAuthedUserOrNull } from "../_lib/auth";

const RESULT_VALIDATOR = v.object({
  channelId: v.string(),
  service: v.string(),
  channelName: v.string(),
  text: v.string(),
  status: v.union(v.literal("posted"), v.literal("failed")),
  error: v.optional(v.string()),
});

const POST_DOC = v.object({
  _id: v.id("social_posts"),
  _creationTime: v.number(),
  projectId: v.id("projects"),
  documentId: v.id("documents"),
  channelId: v.string(),
  service: v.string(),
  channelName: v.string(),
  text: v.string(),
  status: v.union(v.literal("posted"), v.literal("failed")),
  error: v.optional(v.string()),
  createdAt: v.number(),
});

/** Latest announcement attempts for a document, newest first. */
export const listForDocument = query({
  args: { documentId: v.id("documents") },
  returns: v.array(POST_DOC),
  handler: async (ctx, args) => {
    const user = await getAuthedUserOrNull(ctx);
    if (!user) return [];
    const document = await ctx.db.get(args.documentId);
    if (!document || document.userId !== user._id) return [];

    const rows = await ctx.db
      .query("social_posts")
      .withIndex("by_documentId", (q) => q.eq("documentId", args.documentId))
      .order("desc")
      .take(20);
    return rows;
  },
});

export const _recordResults = internalMutation({
  args: {
    projectId: v.id("projects"),
    documentId: v.id("documents"),
    results: v.array(RESULT_VALIDATOR),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const now = Date.now();
    for (const result of args.results) {
      await ctx.db.insert("social_posts", {
        projectId: args.projectId,
        documentId: args.documentId,
        channelId: result.channelId,
        service: result.service,
        channelName: result.channelName,
        text: result.text,
        status: result.status,
        ...(result.error !== undefined ? { error: result.error } : {}),
        createdAt: now,
      });
    }
    return null;
  },
});

export const _get = internalQuery({
  args: { socialPostId: v.id("social_posts") },
  returns: v.union(v.null(), POST_DOC),
  handler: async (ctx, args) => ctx.db.get(args.socialPostId),
});

/** Flip a row after a retry attempt. */
export const _setStatus = internalMutation({
  args: {
    socialPostId: v.id("social_posts"),
    status: v.union(v.literal("posted"), v.literal("failed")),
    error: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.socialPostId, {
      status: args.status,
      // `undefined` removes the field — a successful retry clears the error.
      error: args.error,
      createdAt: Date.now(),
    });
    return null;
  },
});
