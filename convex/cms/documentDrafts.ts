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
import { syncDocumentLinks } from "./_lib/documentLinks";
import {
  deleteDraftContent,
  MAX_DRAFT_CONTENT_BYTES,
  readDraftContent,
  writeDraftContent,
} from "./_lib/draftContent";

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

/**
 * Metadata-only draft list for the always-mounted tab bar. Bodies live in
 * `document_draft_content` and are fetched on demand (`getContent`) when a
 * draft is opened — so this hot subscription never reads (or re-bills)
 * every draft's body on each autosave tick. Explicit projection keeps the
 * metadata payload small and the client type clean (mirrors
 * `snapshots.list`).
 */
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

    return drafts
      .sort((a, b) => a.createdAt - b.createdAt)
      .map((draft) => ({
        _id: draft._id,
        documentId: draft.documentId,
        label: draft.label,
        wordCount: draft.wordCount,
        ...(draft.summary !== undefined ? { summary: draft.summary } : {}),
        createdAt: draft.createdAt,
        updatedAt: draft.updatedAt,
      }));
  },
});

/**
 * Full draft (metadata joined with its title + body). Fetched on demand;
 * resolves the body from the content row.
 */
export const get = query({
  args: { draftId: v.id("document_drafts") },
  handler: async (ctx, args) => {
    const user = await getAuthedUserOrNull(ctx);
    if (!user) return null;
    const draft = await ctx.db.get(args.draftId);
    if (!draft || draft.userId !== user._id) return null;
    const { title, content } = await readDraftContent(ctx, draft);
    return { ...draft, title, content };
  },
});

/**
 * On-demand title + body for a single draft. Read when the editor switches
 * to a draft tab (not a live subscription). Resolves from the content row.
 */
export const getContent = query({
  args: { draftId: v.id("document_drafts") },
  handler: async (ctx, args) => {
    const user = await getAuthedUserOrNull(ctx);
    if (!user) return null;
    const draft = await ctx.db.get(args.draftId);
    if (!draft || draft.userId !== user._id) return null;
    return await readDraftContent(ctx, draft);
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
    const title = copyContent ? document.title : "";

    // Metadata row carries NO body — the title + content live in
    // `document_draft_content`, keyed back by `contentId`.
    const draftId = await ctx.db.insert("document_drafts", {
      documentId: args.documentId,
      projectId: document.projectId,
      userId: user._id,
      label,
      ...(copyContent && document.frontmatter !== undefined
        ? { frontmatterSnapshot: document.frontmatter }
        : {}),
      wordCount: copyContent ? wordCount(mainContent) : 0,
      createdAt: now,
      updatedAt: now,
    });
    const contentId = await writeDraftContent(ctx, {
      draftId,
      documentId: args.documentId,
      projectId: document.projectId,
      userId: user._id,
      title,
      content: mainContent,
    });
    await ctx.db.patch(draftId, { contentId });
    return draftId;
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

    const draftId = await ctx.db.insert("document_drafts", {
      documentId: args.documentId,
      projectId: document.projectId,
      userId: user._id,
      label,
      ...(args.frontmatter !== undefined
        ? { frontmatterSnapshot: args.frontmatter }
        : {}),
      ...(args.summary?.trim() ? { summary: args.summary.trim() } : {}),
      wordCount: wordCount(args.content),
      createdAt: now,
      updatedAt: now,
    });
    const contentId = await writeDraftContent(ctx, {
      draftId,
      documentId: args.documentId,
      projectId: document.projectId,
      userId: user._id,
      title: args.title,
      content: args.content,
    });
    await ctx.db.patch(draftId, { contentId });
    return draftId;
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

/**
 * Hot-path draft autosave (3s debounce). Writes ONLY the draft's content
 * side-table row — never the metadata row — so the tab-bar `list`
 * subscription isn't invalidated on every tick. `title` is required so the
 * write is a single `replace` with no read-before-write (the client always
 * holds the current title). Pre-migration drafts (no `contentId`) upsert by
 * the `by_draftId` index and deliberately leave the metadata row untouched
 * — the backfill sets `contentId` later.
 */
export const autosaveContent = mutation({
  args: {
    draftId: v.id("document_drafts"),
    title: v.string(),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    const key = await getRateLimitKey(ctx);
    await rateLimiter.limit(ctx, "documentDrafts:autosaveContent", {
      key,
      throws: true,
    });

    const user = await getCurrentUser(ctx);
    const draft = await ctx.db.get(args.draftId);
    if (!draft || draft.userId !== user._id) {
      throw new Error("Draft not found");
    }

    const byteLength = new TextEncoder().encode(args.content).byteLength;
    if (byteLength > MAX_DRAFT_CONTENT_BYTES) {
      throw new Error(
        `Draft content is too large (max ${String(Math.round(MAX_DRAFT_CONTENT_BYTES / 1024))} KB).`,
      );
    }

    await writeDraftContent(ctx, {
      draftId: draft._id,
      documentId: draft.documentId,
      projectId: draft.projectId,
      userId: draft.userId,
      title: args.title,
      content: args.content,
      ...(draft.contentId ? { contentId: draft.contentId } : {}),
    });
  },
});

/**
 * Flush-path draft save (manual save, tab switch, unmount). Writes the
 * content row AND refreshes the metadata row's derived fields (wordCount,
 * updatedAt) — plus persists `contentId` when it was missing. Kept named
 * `updateContent` for API stability. Args stay optional; the sole client
 * sends both, so the fallback read never fires in practice.
 */
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

    // Resolve the full row to write. The client always sends both fields;
    // the fallback read only fires if one is omitted.
    let title = args.title;
    let content = args.content;
    if (title === undefined || content === undefined) {
      const current = await readDraftContent(ctx, draft);
      title ??= current.title;
      content ??= current.content;
    }

    const byteLength = new TextEncoder().encode(content).byteLength;
    if (byteLength > MAX_DRAFT_CONTENT_BYTES) {
      throw new Error(
        `Draft content is too large (max ${String(Math.round(MAX_DRAFT_CONTENT_BYTES / 1024))} KB).`,
      );
    }

    const contentId = await writeDraftContent(ctx, {
      draftId: draft._id,
      documentId: draft.documentId,
      projectId: draft.projectId,
      userId: draft.userId,
      title,
      content,
      ...(draft.contentId ? { contentId: draft.contentId } : {}),
    });

    // Refresh metadata; persist the pointer if it was missing.
    await ctx.db.patch(draft._id, {
      wordCount: wordCount(content),
      updatedAt: Date.now(),
      ...(draft.contentId === undefined ? { contentId } : {}),
    });
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

    const { title, content } = await readDraftContent(ctx, draft);

    await ctx.db.patch(draft.documentId, {
      title,
      excerpt: buildExcerpt(content),
      wordCount: wordCount(content),
      frontmatter: draft.frontmatterSnapshot,
      updatedAt: Date.now(),
    });
    const contentId = await writeContent(ctx, {
      documentId: draft.documentId,
      projectId: document.projectId,
      userId: user._id,
      content,
      ...(document.contentId ? { contentId: document.contentId } : {}),
    });
    // Persist the pointer if the target document predates the split.
    if (document.contentId === undefined) {
      await ctx.db.patch(draft.documentId, { contentId });
    }

    // Flush path: the promoted draft body becomes the main document, so
    // recompute its backlink graph from the new content.
    await syncDocumentLinks(ctx, document, content);

    return {
      documentId: draft.documentId,
      title,
      content,
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
    await deleteDraftContent(ctx, args.draftId);
    await ctx.db.delete(args.draftId);
  },
});
