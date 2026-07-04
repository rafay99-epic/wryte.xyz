/**
 * Version snapshots — the editor's automatic safety net.
 *
 * Snapshots capture the MAIN document stream (not parallel drafts) at
 * meaningful points: manual saves (Cmd+S) and a coarse editing interval.
 * Creation is deduped against the latest snapshot's content and the table
 * is pruned to a fixed per-document cap, so write volume stays bounded
 * regardless of how often the client calls in.
 *
 * Bodies live in `document_snapshot_content` (1:1, keyed by snapshotId) so
 * the metadata row stays tiny — the history panel's `list` query and the
 * on-insert prune scan never read full bodies, only `contentHash` for
 * dedup.
 */
import { v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { DatabaseReader, MutationCtx } from "../_generated/server";
import { mutation, query } from "../_generated/server";
import { getAuthedUserOrNull, getCurrentUser } from "../_lib/auth";
import { contentHash } from "../_lib/contentHash";
import { getRateLimitKey, rateLimiter } from "../_lib/rateLimits";
import { countWords } from "../_lib/wordCount";
import {
  buildExcerpt,
  readContent,
  writeContent,
} from "./_lib/documentContent";

/** Hard cap per document — oldest snapshots are pruned past this. */
const MAX_SNAPSHOTS_PER_DOCUMENT = 30;

type SnapshotReason = "manual" | "interval" | "restore";

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

/**
 * Resolves a snapshot's body from the split content row. Returns "" when
 * no content row exists.
 */
async function readSnapshotContent(
  ctx: { db: DatabaseReader },
  snapshot: Doc<"document_snapshots">,
): Promise<string> {
  const row = await ctx.db
    .query("document_snapshot_content")
    .withIndex("by_snapshotId", (q) => q.eq("snapshotId", snapshot._id))
    .unique();
  if (row) return row.content;
  return "";
}

/**
 * Inserts a snapshot row (metadata only, plus its content row) and prunes
 * past the per-document cap. Shared by `create` and the pre-restore backup
 * in `restore`.
 */
async function insertSnapshot(
  ctx: MutationCtx,
  document: Doc<"documents">,
  userId: Id<"users">,
  reason: SnapshotReason,
  title: string,
  content: string,
): Promise<Id<"document_snapshots">> {
  const id = await ctx.db.insert("document_snapshots", {
    documentId: document._id,
    projectId: document.projectId,
    userId,
    reason,
    title,
    contentHash: contentHash(content),
    wordCount: countWords(content),
    createdAt: Date.now(),
  });
  await ctx.db.insert("document_snapshot_content", {
    snapshotId: id,
    documentId: document._id,
    projectId: document.projectId,
    userId,
    content,
  });

  // Metadata-only rows now — this scan reads small documents, not bodies.
  const rows = await ctx.db
    .query("document_snapshots")
    .withIndex("by_documentId", (q) => q.eq("documentId", document._id))
    .order("desc")
    .take(MAX_SNAPSHOTS_PER_DOCUMENT + 1);
  for (const row of rows.slice(MAX_SNAPSHOTS_PER_DOCUMENT)) {
    const contentRow = await ctx.db
      .query("document_snapshot_content")
      .withIndex("by_snapshotId", (q) => q.eq("snapshotId", row._id))
      .unique();
    if (contentRow) await ctx.db.delete(contentRow._id);
    await ctx.db.delete(row._id);
  }

  return id;
}

/** Snapshot metadata for the history panel — content stays server-side. */
export const list = query({
  args: { documentId: v.id("documents") },
  handler: async (ctx, args) => {
    const user = await getAuthedUserOrNull(ctx);
    if (!user) return [];
    await verifyDocumentOwnership(ctx, args.documentId, user._id);

    const rows = await ctx.db
      .query("document_snapshots")
      .withIndex("by_documentId", (q) => q.eq("documentId", args.documentId))
      .order("desc")
      .take(MAX_SNAPSHOTS_PER_DOCUMENT);

    return rows.map((row) => ({
      _id: row._id,
      reason: row.reason,
      title: row.title,
      wordCount: row.wordCount,
      createdAt: row.createdAt,
    }));
  },
});

/** Full snapshot (with content) — fetched on demand for the diff view. */
export const get = query({
  args: { snapshotId: v.id("document_snapshots") },
  handler: async (ctx, args) => {
    const user = await getAuthedUserOrNull(ctx);
    if (!user) return null;
    const snapshot = await ctx.db.get(args.snapshotId);
    if (!snapshot || snapshot.userId !== user._id) return null;
    const content = await readSnapshotContent(ctx, snapshot);
    return { ...snapshot, content };
  },
});

/**
 * Creates a snapshot of the given content. Returns null (no write) when
 * the content matches the latest snapshot — callers can fire-and-forget.
 */
export const create = mutation({
  args: {
    documentId: v.id("documents"),
    title: v.string(),
    content: v.string(),
    reason: v.union(v.literal("manual"), v.literal("interval")),
  },
  handler: async (ctx, args): Promise<Id<"document_snapshots"> | null> => {
    const key = await getRateLimitKey(ctx);
    await rateLimiter.limit(ctx, "snapshots:create", { key, throws: true });

    const user = await getCurrentUser(ctx);
    const document = await verifyDocumentOwnership(
      ctx,
      args.documentId,
      user._id,
    );

    const latest = await ctx.db
      .query("document_snapshots")
      .withIndex("by_documentId", (q) => q.eq("documentId", args.documentId))
      .order("desc")
      .take(1);
    const latestSnapshot = latest[0];
    if (
      latestSnapshot &&
      latestSnapshot.contentHash === contentHash(args.content)
    ) {
      return null;
    }

    return await insertSnapshot(
      ctx,
      document,
      user._id,
      args.reason,
      args.title,
      args.content,
    );
  },
});

/**
 * Restores a snapshot into the main document. The current content is
 * snapshotted first (reason "restore") so a restore is itself reversible.
 */
export const restore = mutation({
  args: { snapshotId: v.id("document_snapshots") },
  handler: async (ctx, args): Promise<{ restoredFrom: number }> => {
    const key = await getRateLimitKey(ctx);
    await rateLimiter.limit(ctx, "snapshots:restore", { key, throws: true });

    const user = await getCurrentUser(ctx);
    const snapshot = await ctx.db.get(args.snapshotId);
    if (!snapshot || snapshot.userId !== user._id) {
      throw new Error("Snapshot not found");
    }
    const document = await verifyDocumentOwnership(
      ctx,
      snapshot.documentId,
      user._id,
    );

    const snapshotContent = await readSnapshotContent(ctx, snapshot);

    const currentContent = await readContent(ctx, document);
    if (currentContent !== snapshotContent) {
      await insertSnapshot(
        ctx,
        document,
        user._id,
        "restore",
        document.title,
        currentContent,
      );
    }

    const contentId = await writeContent(ctx, {
      documentId: document._id,
      projectId: document.projectId,
      userId: user._id,
      content: snapshotContent,
      ...(document.contentId !== undefined
        ? { contentId: document.contentId }
        : {}),
    });

    await ctx.db.patch(document._id, {
      title: snapshot.title,
      excerpt: buildExcerpt(snapshotContent),
      wordCount: countWords(snapshotContent),
      contentId: document.contentId ?? contentId,
      updatedAt: Date.now(),
    });

    return { restoredFrom: snapshot.createdAt };
  },
});
