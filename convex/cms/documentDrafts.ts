import { v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { DatabaseReader } from "../_generated/server";
import { mutation, query } from "../_generated/server";
import { getAuthedUserOrNull, getCurrentUser } from "../_lib/auth";
import { getRateLimitKey, rateLimiter } from "../_lib/rateLimits";
import {
  buildExcerpt,
  readContent,
  writeContent,
} from "./_lib/documentContent";

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
      .take(50);

    return drafts.sort((a, b) => a.createdAt - b.createdAt);
  },
});

export const get = query({
  args: { draftId: v.id("document_drafts") },
  handler: async (ctx, args) => {
    const user = await getAuthedUserOrNull(ctx);
    if (!user) return null;
    const draft = await ctx.db.get(args.draftId);
    if (!draft || draft.userId !== user._id) return null;
    return draft;
  },
});

export const create = mutation({
  args: {
    documentId: v.id("documents"),
    label: v.optional(v.string()),
    copyFromMain: v.optional(v.boolean()),
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

    const existing = await ctx.db
      .query("document_drafts")
      .withIndex("by_documentId", (q) => q.eq("documentId", args.documentId))
      .take(100);

    const now = Date.now();
    const label = args.label?.trim() || `Draft ${String(existing.length + 1)}`;

    const copyContent = args.copyFromMain ?? false;
    const mainContent = copyContent ? await readContent(ctx, document) : "";

    return await ctx.db.insert("document_drafts", {
      documentId: args.documentId,
      projectId: document.projectId,
      userId: user._id,
      label,
      contentSnapshot: mainContent,
      titleSnapshot: copyContent ? document.title : "",
      ...(copyContent && document.frontmatter !== undefined
        ? { frontmatterSnapshot: document.frontmatter }
        : {}),
      wordCount: copyContent ? wordCount(mainContent) : 0,
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

export const updateContent = mutation({
  args: {
    draftId: v.id("document_drafts"),
    title: v.optional(v.string()),
    content: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const key = await getRateLimitKey(ctx);
    await rateLimiter.limit(ctx, "documentDrafts:updateContent", {
      key,
      throws: true,
    });

    const user = await getCurrentUser(ctx);
    const draft = await ctx.db.get(args.draftId);
    if (!draft || draft.userId !== user._id) {
      throw new Error("Draft not found");
    }

    const updates: {
      titleSnapshot?: string;
      contentSnapshot?: string;
      wordCount?: number;
      updatedAt: number;
    } = { updatedAt: Date.now() };

    if (args.title !== undefined) updates.titleSnapshot = args.title;
    if (args.content !== undefined) {
      updates.contentSnapshot = args.content;
      updates.wordCount = wordCount(args.content);
    }

    await ctx.db.patch(args.draftId, updates);
  },
});

export const promoteToMain = mutation({
  args: { draftId: v.id("document_drafts") },
  handler: async (ctx, args) => {
    const key = await getRateLimitKey(ctx);
    await rateLimiter.limit(ctx, "documentDrafts:promote", {
      key,
      throws: true,
    });

    const user = await getCurrentUser(ctx);
    const draft = await ctx.db.get(args.draftId);
    if (!draft || draft.userId !== user._id) {
      throw new Error("Draft not found");
    }
    const document = await verifyDocumentOwnership(
      ctx,
      draft.documentId,
      user._id,
    );

    await ctx.db.patch(draft.documentId, {
      title: draft.titleSnapshot,
      excerpt: buildExcerpt(draft.contentSnapshot),
      wordCount: wordCount(draft.contentSnapshot),
      content: undefined,
      frontmatter: draft.frontmatterSnapshot,
      updatedAt: Date.now(),
    });
    await writeContent(ctx, {
      documentId: draft.documentId,
      projectId: document.projectId,
      userId: user._id,
      content: draft.contentSnapshot,
    });

    return {
      documentId: draft.documentId,
      title: draft.titleSnapshot,
      content: draft.contentSnapshot,
      frontmatter: draft.frontmatterSnapshot,
    };
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
