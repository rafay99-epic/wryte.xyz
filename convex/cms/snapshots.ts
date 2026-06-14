/**
 * Version snapshots — the editor's automatic safety net.
 *
 * Snapshots capture the MAIN document stream (not parallel drafts) at
 * meaningful points: manual saves (Cmd+S) and a coarse editing interval.
 * Creation is deduped against the latest snapshot's content and the table
 * is pruned to a fixed per-document cap, so write volume stays bounded
 * regardless of how often the client calls in.
 */
import { v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { DatabaseReader, MutationCtx } from "../_generated/server";
import { mutation, query } from "../_generated/server";
import { getAuthedUserOrNull, getCurrentUser } from "../_lib/auth";
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
 * Inserts a snapshot row and prunes past the per-document cap.
 * Shared by `create` and the pre-restore backup in `restore`.
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
    content,
    wordCount: countWords(content),
    createdAt: Date.now(),
  });

  const rows = await ctx.db
    .query("document_snapshots")
    .withIndex("by_documentId", (q) => q.eq("documentId", document._id))
    .order("desc")
    .take(MAX_SNAPSHOTS_PER_DOCUMENT + 10);
  for (const row of rows.slice(MAX_SNAPSHOTS_PER_DOCUMENT)) {
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
    return snapshot;
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
    if (latest[0] && latest[0].content === args.content) return null;

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

    const currentContent = await readContent(ctx, document);
    if (currentContent !== snapshot.content) {
      await insertSnapshot(
        ctx,
        document,
        user._id,
        "restore",
        document.title,
        currentContent,
      );
    }

    await ctx.db.patch(document._id, {
      title: snapshot.title,
      excerpt: buildExcerpt(snapshot.content),
      wordCount: countWords(snapshot.content),
      content: undefined,
      updatedAt: Date.now(),
    });
    await writeContent(ctx, {
      documentId: document._id,
      projectId: document.projectId,
      userId: user._id,
      content: snapshot.content,
    });

    return { restoredFrom: snapshot.createdAt };
  },
});
