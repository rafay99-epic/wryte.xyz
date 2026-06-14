/**
 * Single source of truth for reading and writing a document's body.
 *
 * The body lives in the `document_content` table (1:1 with `documents`,
 * keyed by `documentId`) rather than inline on the document row, so the
 * hot reactive queries that list/board/calendar documents never read
 * article bodies — that read amplification was the dominant source of
 * Convex database-bandwidth usage.
 *
 * During the migration window some rows still carry the legacy inline
 * `documents.content`; every read here falls back to it so nothing breaks
 * before `_backfillDocumentContent` has drained those rows. Once the
 * backfill is confirmed complete the inline field (and the fallback) can
 * be removed.
 */
import type { Id } from "../../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../../_generated/server";

/** Length cap for the denormalized `documents.excerpt` preview. */
const EXCERPT_LENGTH = 200;

/**
 * Builds the short preview stored on `documents.excerpt` for list/board
 * cards. Mirrors the projection the list query used to derive inline.
 */
export function buildExcerpt(content: string): string {
  return content.length > EXCERPT_LENGTH
    ? `${content.slice(0, EXCERPT_LENGTH)}...`
    : content;
}

/**
 * Reads a document's body given the document row. Prefers the dedicated
 * `document_content` table; falls back to the legacy inline field for
 * rows not yet backfilled. Returns "" when neither exists.
 */
export async function readContent(
  ctx: { db: QueryCtx["db"] },
  doc: { _id: Id<"documents">; content?: string },
): Promise<string> {
  const row = await ctx.db
    .query("document_content")
    .withIndex("by_documentId", (q) => q.eq("documentId", doc._id))
    .unique();
  if (row) return row.content;
  return doc.content ?? "";
}

/**
 * Reads a document's body by id. Loads the parent row only when needed
 * for the legacy fallback, so the common (backfilled) path is a single
 * indexed read of `document_content`.
 */
export async function readContentById(
  ctx: { db: QueryCtx["db"] },
  documentId: Id<"documents">,
): Promise<string> {
  const row = await ctx.db
    .query("document_content")
    .withIndex("by_documentId", (q) => q.eq("documentId", documentId))
    .unique();
  if (row) return row.content;
  const doc = await ctx.db.get(documentId);
  return doc?.content ?? "";
}

/**
 * Upserts a document's body into `document_content`. Callers are
 * responsible for clearing the legacy inline `documents.content` field
 * (cheapest done in the same `patch` they already issue) and for keeping
 * `documents.excerpt` / `documents.wordCount` in sync via `buildExcerpt`.
 */
export async function writeContent(
  ctx: MutationCtx,
  params: {
    documentId: Id<"documents">;
    projectId: Id<"projects">;
    userId: Id<"users">;
    content: string;
  },
): Promise<void> {
  const existing = await ctx.db
    .query("document_content")
    .withIndex("by_documentId", (q) => q.eq("documentId", params.documentId))
    .unique();
  const now = Date.now();
  if (existing) {
    await ctx.db.patch(existing._id, {
      content: params.content,
      updatedAt: now,
    });
    return;
  }
  await ctx.db.insert("document_content", {
    documentId: params.documentId,
    projectId: params.projectId,
    userId: params.userId,
    content: params.content,
    updatedAt: now,
  });
}

/**
 * Deletes a document's body row. Used by every hard-delete path
 * (permanent trash delete, project wipe, account self-destruct).
 */
export async function deleteContent(
  ctx: MutationCtx,
  documentId: Id<"documents">,
): Promise<void> {
  const existing = await ctx.db
    .query("document_content")
    .withIndex("by_documentId", (q) => q.eq("documentId", documentId))
    .unique();
  if (existing) await ctx.db.delete(existing._id);
}
