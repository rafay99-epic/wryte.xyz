/**
 * Single source of truth for reading and writing a document's body.
 *
 * The body lives in the `document_content` table (1:1 with `documents`,
 * keyed by `documentId`) rather than inline on the document row, so the
 * hot reactive queries that list/board/calendar documents never read
 * article bodies — that read amplification was the dominant source of
 * Convex database-bandwidth usage.
 */
import type { Id } from "../../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../../_generated/server";

/** Length cap for the denormalized `documents.excerpt` preview. */
const EXCERPT_LENGTH = 200;

/**
 * Minimum term length for a body search. Below this the index returns noise.
 *
 * Exported because the callers that *gate* on it live on the client (the
 * command palette, the project content search) while the query that *enforces*
 * it lives in `cms/documents.searchContent`. Both sides reading this constant
 * is what keeps the client's gate and the server's guard from drifting apart.
 */
export const MIN_CONTENT_TERM = 3;

/**
 * Hits returned per body search. Every hit bills its whole body, so this cap
 * is the feature's main cost lever — keep it small.
 */
export const CONTENT_SEARCH_LIMIT = 8;

/**
 * Builds the short preview stored on `documents.excerpt` for list/board
 * cards. Mirrors the projection the list query used to derive inline.
 */
export function buildExcerpt(content: string): string {
  return content.length > EXCERPT_LENGTH
    ? `${content.slice(0, EXCERPT_LENGTH)}...`
    : content;
}

/** Characters of body context kept on each side of the first matched term. */
const SNIPPET_RADIUS = 90;

/**
 * Body excerpt centred on the first query term, for the command palette's
 * content-search rows. Keeps the wire payload at ~200 characters per hit so
 * article bodies stay on the server even though the search had to read them.
 *
 * The last term of a Convex search expression is prefix-matched, so a hit can
 * legitimately have no literal `indexOf` match (searching "deplo" matches
 * "deployment"). Falling back to offset 0 then yields the article's opening,
 * which is a useful excerpt rather than an empty string.
 */
export function extractSnippet(content: string, term: string): string {
  const haystack = content.toLowerCase();
  const firstHit =
    term
      .toLowerCase()
      .split(/\s+/)
      .map((token) => haystack.indexOf(token))
      .filter((index) => index >= 0)
      .sort((a, b) => a - b)[0] ?? 0;

  const start = Math.max(0, firstHit - SNIPPET_RADIUS);
  const end = Math.min(content.length, firstHit + SNIPPET_RADIUS);
  const body = content.slice(start, end).replace(/\s+/g, " ").trim();

  return `${start > 0 ? "…" : ""}${body}${end < content.length ? "…" : ""}`;
}

/**
 * Reads a document's body given the document row. Uses the denormalized
 * `contentId` pointer when present (direct `get`, no index lookup), else
 * the `by_documentId` index. Returns "" when no content row exists (e.g.
 * a freshly created document that hasn't been saved yet).
 */
export async function readContent(
  ctx: { db: QueryCtx["db"] },
  doc: {
    _id: Id<"documents">;
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
  return "";
}

/**
 * Reads a document's body by id via the `by_documentId` index. Returns ""
 * when no content row exists (e.g. a document that hasn't been saved yet).
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
  return "";
}

/**
 * Upserts a document's body into `document_content`. Callers are
 * responsible for keeping `documents.excerpt` / `documents.wordCount`
 * in sync via `buildExcerpt`.
 *
 * Pass `contentId` (the caller usually already holds the `documents` row,
 * which carries the denormalized pointer) to patch the body row directly.
 * Without it, the upsert must first READ the existing row via the index —
 * and Convex bills that read at the full body size, doubling the cost of
 * every autosave tick. The index-upsert fallback is still needed at
 * document creation, before the pointer exists (the caller then persists
 * the returned id onto `documents.contentId`).
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
