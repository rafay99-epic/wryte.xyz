import { v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { DatabaseReader } from "../_generated/server";
import { mutation, query } from "../_generated/server";
import { getAuthedUserOrNull, getCurrentUser } from "../_lib/auth";
import { getRateLimitKey, rateLimiter } from "../_lib/rateLimits";

async function verifyDocumentOwnership(
  ctx: { db: DatabaseReader },
  documentId: Id<"documents">,
  userId: Id<"users">,
): Promise<Doc<"documents">> {
  const document = await ctx.db.get(documentId);
  if (!document || document.trashedAt !== undefined) {
    throw new Error("Document not found");
  }
  const project = await ctx.db.get(document.projectId);
  if (!project || project.userId !== userId) {
    throw new Error("Unauthorized: you do not own this document");
  }
  return document;
}

function wordCount(content: string): number {
  const trimmed = content.trim();
  return trimmed ? trimmed.split(/\s+/).length : 0;
}

export const list = query({
  args: { documentId: v.id("documents") },
  handler: async (ctx, args) => {
    const user = await getAuthedUserOrNull(ctx);
    if (!user) return [];
    await verifyDocumentOwnership(ctx, args.documentId, user._id);

    const drafts = await ctx.db
      .query("document_drafts")
      .withIndex("by_documentId", (q) => q.eq("documentId", args.documentId))
      .collect();

    return drafts.sort((a, b) => b.createdAt - a.createdAt);
  },
});

export const createFromDocument = mutation({
  args: {
    documentId: v.id("documents"),
    label: v.string(),
    summary: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const key = await getRateLimitKey(ctx);
    await rateLimiter.limit(ctx, "documentDrafts:create", {
      key,
      throws: true,
    });

    const user = await getCurrentUser(ctx);
    const document = await verifyDocumentOwnership(
      ctx,
      args.documentId,
      user._id,
    );
    const now = Date.now();
    const label =
      args.label.trim() || `Draft ${new Date(now).toLocaleString()}`;

    return await ctx.db.insert("document_drafts", {
      documentId: args.documentId,
      projectId: document.projectId,
      userId: user._id,
      label,
      contentSnapshot: document.content,
      ...(document.frontmatter !== undefined
        ? { frontmatterSnapshot: document.frontmatter }
        : {}),
      titleSnapshot: document.title,
      ...(args.summary?.trim() ? { summary: args.summary.trim() } : {}),
      wordCount: wordCount(document.content),
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const createSnapshot = mutation({
  args: {
    documentId: v.id("documents"),
    label: v.string(),
    title: v.string(),
    content: v.string(),
    frontmatter: v.optional(v.string()),
    summary: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const key = await getRateLimitKey(ctx);
    await rateLimiter.limit(ctx, "documentDrafts:create", {
      key,
      throws: true,
    });

    const user = await getCurrentUser(ctx);
    const document = await verifyDocumentOwnership(
      ctx,
      args.documentId,
      user._id,
    );
    const now = Date.now();
    const label =
      args.label.trim() || `Draft ${new Date(now).toLocaleString()}`;

    return await ctx.db.insert("document_drafts", {
      documentId: args.documentId,
      projectId: document.projectId,
      userId: user._id,
      label,
      contentSnapshot: args.content,
      ...(args.frontmatter !== undefined
        ? { frontmatterSnapshot: args.frontmatter }
        : {}),
      titleSnapshot: args.title,
      ...(args.summary?.trim() ? { summary: args.summary.trim() } : {}),
      wordCount: wordCount(args.content),
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const update = mutation({
  args: {
    draftId: v.id("document_drafts"),
    label: v.optional(v.string()),
    summary: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const key = await getRateLimitKey(ctx);
    await rateLimiter.limit(ctx, "documentDrafts:update", {
      key,
      throws: true,
    });

    const user = await getCurrentUser(ctx);
    const draft = await ctx.db.get(args.draftId);
    if (!draft || draft.userId !== user._id) {
      throw new Error("Draft not found");
    }

    const updates: {
      label?: string;
      summary?: string;
      updatedAt: number;
    } = { updatedAt: Date.now() };
    if (args.label !== undefined) updates.label = args.label.trim();
    if (args.summary !== undefined) updates.summary = args.summary.trim();

    await ctx.db.patch(args.draftId, updates);
  },
});

export const remove = mutation({
  args: { draftId: v.id("document_drafts") },
  handler: async (ctx, args) => {
    const key = await getRateLimitKey(ctx);
    await rateLimiter.limit(ctx, "documentDrafts:remove", {
      key,
      throws: true,
    });

    const user = await getCurrentUser(ctx);
    const draft = await ctx.db.get(args.draftId);
    if (!draft || draft.userId !== user._id) {
      throw new Error("Draft not found");
    }
    await ctx.db.delete(args.draftId);
  },
});

export const restoreToDocument = mutation({
  args: { draftId: v.id("document_drafts") },
  handler: async (ctx, args) => {
    const key = await getRateLimitKey(ctx);
    await rateLimiter.limit(ctx, "documentDrafts:restore", {
      key,
      throws: true,
    });

    const user = await getCurrentUser(ctx);
    const draft = await ctx.db.get(args.draftId);
    if (!draft || draft.userId !== user._id) {
      throw new Error("Draft not found");
    }
    await verifyDocumentOwnership(ctx, draft.documentId, user._id);

    await ctx.db.patch(draft.documentId, {
      title: draft.titleSnapshot,
      content: draft.contentSnapshot,
      frontmatter: draft.frontmatterSnapshot,
      updatedAt: Date.now(),
    });

    return {
      documentId: draft.documentId,
      title: draft.titleSnapshot,
      content: draft.contentSnapshot,
      frontmatter: draft.frontmatterSnapshot,
      restoredFrom: draft.createdAt,
    };
  },
});
