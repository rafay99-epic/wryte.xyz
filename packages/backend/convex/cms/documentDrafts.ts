import { v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type {
  DatabaseReader,
  MutationCtx,
  QueryCtx,
} from "../_generated/server";
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
 * Hard cap on drafts per document. Enforced at creation so `list`'s
 * `.take(50)` is exact — without it, draft #51 would exist (and bill
 * storage + autosaves) while never appearing in the tab bar.
 */
const MAX_DRAFTS_PER_DOCUMENT = 50;
const MAX_LABEL_LENGTH = 200;
const MAX_SUMMARY_LENGTH = 1000;

function assertDraftCapacity(existingCount: number): void {
  if (existingCount >= MAX_DRAFTS_PER_DOCUMENT) {
    throw new Error(
      `Draft limit reached (${String(MAX_DRAFTS_PER_DOCUMENT)} per article). Delete a draft first.`,
    );
  }
}

function assertMetaLengths(label?: string, summary?: string): void {
  if (label !== undefined && label.length > MAX_LABEL_LENGTH) {
    throw new Error(
      `Draft label is too long (max ${String(MAX_LABEL_LENGTH)} characters).`,
    );
  }
  if (summary !== undefined && summary.length > MAX_SUMMARY_LENGTH) {
    throw new Error(
      `Draft summary is too long (max ${String(MAX_SUMMARY_LENGTH)} characters).`,
    );
  }
}

function assertContentSize(content: string): void {
  const byteLength = new TextEncoder().encode(content).byteLength;
  if (byteLength > MAX_DRAFT_CONTENT_BYTES) {
    throw new Error(
      `Draft content is too large (max ${String(Math.round(MAX_DRAFT_CONTENT_BYTES / 1024))} KB).`,
    );
  }
}

/**
 * `list`'s body with the actor passed in explicitly. Shared with the MCP
 * handler, which has no `ctx.auth` under component dispatch — see
 * `_lib/auth.ts → requireCaller`.
 *
 * Metadata-only draft list for the always-mounted tab bar. Bodies live in
 * `document_draft_content` and are fetched on demand (`getContent`) when a
 * draft is opened — so this hot subscription never reads (or re-bills)
 * every draft's body on each autosave tick. Explicit projection keeps the
 * metadata payload small and the client type clean (mirrors
 * `snapshots.list`).
 */
export async function draftsListForUser(
  ctx: QueryCtx,
  userId: Id<"users">,
  documentId: Id<"documents">,
) {
  await verifyDocumentOwnership(ctx, documentId, userId);

  const drafts = await ctx.db
    .query("document_drafts")
    .withIndex("by_documentId", (q) => q.eq("documentId", documentId))
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
}

export const list = query({
  args: { documentId: v.id("documents") },
  handler: async (ctx, args) => {
    const user = await getAuthedUserOrNull(ctx);
    if (!user) return [];
    return await draftsListForUser(ctx, user._id, args.documentId);
  },
});

/**
 * `get`'s body with the actor passed in explicitly (MCP twin — see
 * `draftsListForUser`). Returns null when the draft doesn't exist or the
 * caller doesn't own it, mirroring the public query's empty-state contract.
 */
export async function draftGetForUser(
  ctx: QueryCtx,
  userId: Id<"users">,
  draftId: Id<"document_drafts">,
) {
  const draft = await ctx.db.get(draftId);
  if (!draft || draft.userId !== userId) return null;
  const { title, content } = await readDraftContent(ctx, draft);
  return { ...draft, title, content };
}

/**
 * Full draft (metadata joined with its title + body). Fetched on demand;
 * resolves the body from the content row.
 */
export const get = query({
  args: { draftId: v.id("document_drafts") },
  handler: async (ctx, args) => {
    // Auth and the draft row are independent reads — resolve them together
    // (ownership is still checked before anything is returned).
    const [user, draft] = await Promise.all([
      getAuthedUserOrNull(ctx),
      ctx.db.get(args.draftId),
    ]);
    if (!user || !draft || draft.userId !== user._id) return null;
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
    // This runs on every cold draft-tab switch — resolve the independent
    // auth and draft reads together to shave a serial roundtrip (ownership
    // is still checked before anything is returned).
    const [user, draft] = await Promise.all([
      getAuthedUserOrNull(ctx),
      ctx.db.get(args.draftId),
    ]);
    if (!user || !draft || draft.userId !== user._id) return null;
    return await readDraftContent(ctx, draft);
  },
});

/**
 * `create`'s body with the actor passed in explicitly. Shared with the MCP
 * handler — rate-limit key comes from `user.tokenIdentifier` rather than
 * `getRateLimitKey(ctx)`, which reads `ctx.auth` and returns the literal
 * `"anonymous"` under component dispatch (see `documents.createDocumentForUser`).
 */
export async function createDraftForUser(
  ctx: MutationCtx,
  user: Doc<"users">,
  args: {
    documentId: Id<"documents">;
    label?: string;
    copyFromMain?: boolean;
  },
): Promise<Id<"document_drafts">> {
  await rateLimiter.limit(ctx, "documentDrafts:create", {
    key: user.tokenIdentifier,
    throws: true,
  });

  assertMetaLengths(args.label);
  const document = await verifyDocumentOwnership(
    ctx,
    args.documentId,
    user._id,
  );

  const copyContent = args.copyFromMain ?? false;
  // The existing-draft count (cap + auto-label) and the main body read
  // are independent — resolve them together.
  const [existing, mainContent] = await Promise.all([
    ctx.db
      .query("document_drafts")
      .withIndex("by_documentId", (q) => q.eq("documentId", args.documentId))
      .take(MAX_DRAFTS_PER_DOCUMENT + 1),
    copyContent ? readContent(ctx, document) : Promise.resolve(""),
  ]);
  assertDraftCapacity(existing.length);

  const now = Date.now();
  const label = args.label?.trim() || `Draft ${String(existing.length + 1)}`;
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
}

export const create = mutation({
  args: {
    documentId: v.id("documents"),
    label: v.optional(v.string()),
    copyFromMain: v.optional(v.boolean()),
  },
  returns: v.id("document_drafts"),
  handler: async (ctx, args) =>
    await createDraftForUser(ctx, await getCurrentUser(ctx), args),
});

/**
 * `createSnapshot`'s body with the actor passed in explicitly (MCP twin —
 * see `createDraftForUser` for the rate-limit key rationale). This is the
 * tool an agent uses to write a full draft version: label + title + body +
 * optional frontmatter snapshot and summary.
 */
export async function createDraftSnapshotForUser(
  ctx: MutationCtx,
  user: Doc<"users">,
  args: {
    documentId: Id<"documents">;
    label: string;
    title: string;
    content: string;
    frontmatter?: string;
    summary?: string;
  },
): Promise<Id<"document_drafts">> {
  await rateLimiter.limit(ctx, "documentDrafts:create", {
    key: user.tokenIdentifier,
    throws: true,
  });

  // Same bounds as the interactive draft paths — without these, an
  // oversized body written here would later ride `promoteToMain` into
  // `document_content`, bypassing the documents-side cap entirely.
  assertContentSize(args.content);
  assertMetaLengths(args.label, args.summary);

  const document = await verifyDocumentOwnership(
    ctx,
    args.documentId,
    user._id,
  );
  const existing = await ctx.db
    .query("document_drafts")
    .withIndex("by_documentId", (q) => q.eq("documentId", args.documentId))
    .take(MAX_DRAFTS_PER_DOCUMENT + 1);
  assertDraftCapacity(existing.length);

  const now = Date.now();
  const label = args.label.trim() || `Draft ${new Date(now).toLocaleString()}`;

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
}

export const createSnapshot = mutation({
  args: {
    documentId: v.id("documents"),
    label: v.string(),
    title: v.string(),
    content: v.string(),
    frontmatter: v.optional(v.string()),
    summary: v.optional(v.string()),
  },
  returns: v.id("document_drafts"),
  handler: async (ctx, args) =>
    await createDraftSnapshotForUser(ctx, await getCurrentUser(ctx), args),
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

    assertMetaLengths(args.label, args.summary);
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

    assertContentSize(args.content);
    const user = await getCurrentUser(ctx);
    const draft = await ctx.db.get(args.draftId);
    if (!draft || draft.userId !== user._id) {
      throw new Error("Draft not found");
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
 * `updateContent`'s body with the actor passed in explicitly (MCP twin —
 * see `createDraftForUser` for the rate-limit key rationale).
 */
export async function updateDraftContentForUser(
  ctx: MutationCtx,
  user: Doc<"users">,
  args: {
    draftId: Id<"document_drafts">;
    title?: string;
    content?: string;
  },
): Promise<null> {
  await rateLimiter.limit(ctx, "documentDrafts:updateContent", {
    key: user.tokenIdentifier,
    throws: true,
  });

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

  assertContentSize(content);

  const contentId = await writeDraftContent(ctx, {
    draftId: draft._id,
    documentId: draft.documentId,
    projectId: draft.projectId,
    userId: draft.userId,
    title,
    content,
    ...(draft.contentId ? { contentId: draft.contentId } : {}),
  });

  // Refresh metadata; persist the pointer whenever it's missing OR stale
  // (a stale pointer self-heals inside `writeDraftContent`, but if it's
  // never written back every future autosave pays the full-body index
  // read this architecture exists to avoid).
  await ctx.db.patch(draft._id, {
    wordCount: wordCount(content),
    updatedAt: Date.now(),
    ...(draft.contentId !== contentId ? { contentId } : {}),
  });
  return null;
}

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
  returns: v.null(),
  handler: async (ctx, args) =>
    await updateDraftContentForUser(ctx, await getCurrentUser(ctx), args),
});

/**
 * `promoteToMain`'s body with the actor passed in explicitly (MCP twin —
 * see `createDraftForUser` for the rate-limit key rationale).
 */
export async function promoteDraftToMainForUser(
  ctx: MutationCtx,
  user: Doc<"users">,
  args: { draftId: Id<"document_drafts"> },
): Promise<{
  documentId: Id<"documents">;
  title: string;
  content: string;
  frontmatter: string | undefined;
}> {
  await rateLimiter.limit(ctx, "documentDrafts:promote", {
    key: user.tokenIdentifier,
    throws: true,
  });

  const draft = await ctx.db.get(args.draftId);
  if (!draft || draft.userId !== user._id) {
    throw new Error("Draft not found");
  }
  // Ownership, the draft body, and the conflict lock all depend only on
  // the draft row — resolve them together.
  const [document, { title, content }, openConflict] = await Promise.all([
    verifyDocumentOwnership(ctx, draft.documentId, user._id),
    readDraftContent(ctx, draft),
    ctx.db
      .query("sync_conflicts")
      .withIndex("by_documentId_unresolved", (q) =>
        q.eq("documentId", draft.documentId).eq("resolvedAt", undefined),
      )
      .first(),
  ]);

  // Same defense-in-depth lock as `documents.update` / `autosaveBody`:
  // promoting overwrites the main body, so it must not slip past a
  // pending sync conflict either.
  if (openConflict) {
    throw new Error(
      "This document has a pending sync conflict. Resolve it before making changes.",
    );
  }

  await ctx.db.patch(draft.documentId, {
    title,
    excerpt: buildExcerpt(content),
    wordCount: wordCount(content),
    // Only replace the document's frontmatter when the draft actually
    // carries a snapshot. Patching `undefined` would UNSET the field —
    // promoting a blank draft used to silently wipe Main's frontmatter.
    ...(draft.frontmatterSnapshot !== undefined
      ? { frontmatter: draft.frontmatterSnapshot }
      : {}),
    updatedAt: Date.now(),
  });
  const contentId = await writeContent(ctx, {
    documentId: draft.documentId,
    projectId: document.projectId,
    userId: user._id,
    content,
    ...(document.contentId ? { contentId: document.contentId } : {}),
  });
  // Persist the pointer when it's missing (pre-split doc) or stale
  // (self-healed inside `writeContent`).
  if (document.contentId !== contentId) {
    await ctx.db.patch(draft.documentId, { contentId });
  }

  // Flush path: the promoted draft body becomes the main document, so
  // recompute its backlink graph from the new content.
  await syncDocumentLinks(ctx, document, content);

  return {
    documentId: draft.documentId,
    title,
    content,
    frontmatter: draft.frontmatterSnapshot ?? document.frontmatter,
  };
}

export const promoteToMain = mutation({
  args: { draftId: v.id("document_drafts") },
  handler: async (ctx, args) =>
    await promoteDraftToMainForUser(ctx, await getCurrentUser(ctx), args),
});

/**
 * `remove`'s body with the actor passed in explicitly (MCP twin — see
 * `createDraftForUser` for the rate-limit key rationale).
 */
export async function removeDraftForUser(
  ctx: MutationCtx,
  user: Doc<"users">,
  args: { draftId: Id<"document_drafts"> },
): Promise<null> {
  await rateLimiter.limit(ctx, "documentDrafts:remove", {
    key: user.tokenIdentifier,
    throws: true,
  });

  const draft = await ctx.db.get(args.draftId);
  if (!draft || draft.userId !== user._id) {
    throw new Error("Draft not found");
  }
  await deleteDraftContent(ctx, args.draftId, draft.contentId);
  await ctx.db.delete(args.draftId);
  return null;
}

export const remove = mutation({
  args: { draftId: v.id("document_drafts") },
  returns: v.null(),
  handler: async (ctx, args) =>
    await removeDraftForUser(ctx, await getCurrentUser(ctx), args),
});
