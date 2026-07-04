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
 * Reads a document's body given the document row. Uses the denormalized
 * `contentId` pointer when present (direct `get`, no index lookup), else
 * the `by_documentId` index; falls back to the legacy inline field for
 * rows not yet backfilled. Returns "" when neither exists.
 */
export async function readContent(
  ctx: { db: QueryCtx["db"] },
  doc: {
    _id: Id<"documents">;
    content?: string;
    contentId?: Id<"document_content">;
  },
): Promise<string> {
  if (doc.contentId) {
    const row = await ctx.db.get(doc.contentId);
    if (row) return row.content;
  }
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
 *
 * Pass `contentId` (the caller usually already holds the `documents` row,
 * which carries the denormalized pointer) to patch the body row directly.
 * Without it, the upsert must first READ the existing row via the index —
 * and Convex bills that read at the full body size, doubling the cost of
 * every autosave tick. The fallback exists only for pre-migration rows.
 *
 * Returns the content row id so callers creating a document (or hitting
 * the fallback) can persist the pointer onto `documents.contentId`.
 */
export async function writeContent(
  ctx: MutationCtx,
  params: {
    documentId: Id<"documents">;
    projectId: Id<"projects">;
    userId: Id<"users">;
    content: string;
    contentId?: Id<"document_content">;
  },
): Promise<Id<"document_content">> {
  const now = Date.now();
  if (params.contentId) {
    try {
      // `replace` (not `get`+`patch`): we hold every field of the row, so
      // we can overwrite it without first reading N bytes back. This is
      // what makes the hot path a single N-byte write instead of 2N.
      await ctx.db.replace(params.contentId, {
        documentId: params.documentId,
        projectId: params.projectId,
        userId: params.userId,
        content: params.content,
        updatedAt: now,
      });
      return params.contentId;
    } catch {
      // Stale pointer (row deleted out-of-band) — fall through to the
      // index-based upsert, which self-heals by returning the fresh id.
    }
  }
  const existing = await ctx.db
    .query("document_content")
    .withIndex("by_documentId", (q) => q.eq("documentId", params.documentId))
    .unique();
  if (existing) {
    await ctx.db.patch(existing._id, {
      content: params.content,
      updatedAt: now,
    });
    return existing._id;
  }
  return await ctx.db.insert("document_content", {
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
