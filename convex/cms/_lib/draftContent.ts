/**
 * Single source of truth for reading and writing a draft's title + body.
 *
 * Draft bodies live in the `document_draft_content` table (1:1 with
 * `document_drafts`, keyed by `draftId`) rather than inline on the draft
 * row, so the always-mounted draft tab bar's `list` subscription never
 * reads (and re-bills) every draft's full body on each autosave tick —
 * the same read-amplification fix `documents` got via `document_content`.
 *
 * `title` rides on the content row (not the metadata row) so title edits
 * travel the hot path without invalidating the tab-bar list subscription.
 *
 * During the migration window some rows still carry the legacy inline
 * `document_drafts.contentSnapshot` / `titleSnapshot`; every read here
 * falls back to them so nothing breaks before the backfill drains those
 * rows. Once the backfill is confirmed complete the inline fields (and the
 * fallback) can be removed.
 */
import type { Id } from "../../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../../_generated/server";

/**
 * Soft upper bound on a draft body's size. Mirrors `MAX_CONTENT_BYTES` in
 * `cms/documents.ts` (Convex's 1MB per-document ceiling is the hard limit;
 * we stay well below it). Kept as a local copy because `documents.ts`'s
 * constant is not exported and lives outside this slice's scope — extract
 * to one shared constant if a third consumer appears.
 */
export const MAX_DRAFT_CONTENT_BYTES = 500 * 1024;

export type DraftContent = { title: string; content: string };

/** Shape of a draft metadata row this module needs to resolve its body. */
type DraftLike = {
  _id: Id<"document_drafts">;
  contentId?: Id<"document_draft_content">;
  titleSnapshot?: string;
  contentSnapshot?: string;
};

/**
 * Reads a draft's title + body given the draft row. Prefers the
 * denormalized `contentId` pointer (direct `get`, no index lookup), else
 * the `by_draftId` index; falls back to the legacy inline snapshot fields
 * for rows not yet backfilled. Returns empty strings when nothing exists.
 */
export async function readDraftContent(
  ctx: { db: QueryCtx["db"] },
  draft: DraftLike,
): Promise<DraftContent> {
  if (draft.contentId) {
    const row = await ctx.db.get(draft.contentId);
    if (row) return { title: row.title, content: row.content };
  }
  const row = await ctx.db
    .query("document_draft_content")
    .withIndex("by_draftId", (q) => q.eq("draftId", draft._id))
    .unique();
  if (row) return { title: row.title, content: row.content };
  return {
    title: draft.titleSnapshot ?? "",
    content: draft.contentSnapshot ?? "",
  };
}

/**
 * Upserts a draft's title + body into `document_draft_content`.
 *
 * Pass `contentId` (the caller usually already holds the `document_drafts`
 * row, which carries the denormalized pointer) to `replace` the row
 * directly — we hold every field, so the hot path is a single N-byte write
 * with no read-before-write. Without it the upsert must first READ the
 * existing row via the index; Convex bills that read at full body size, so
 * this fallback exists only for pre-migration rows.
 *
 * Returns the content row id so callers creating a draft (or hitting the
 * fallback) can persist the pointer onto `document_drafts.contentId`.
 */
export async function writeDraftContent(
  ctx: MutationCtx,
  params: {
    draftId: Id<"document_drafts">;
    documentId: Id<"documents">;
    projectId: Id<"projects">;
    userId: Id<"users">;
    title: string;
    content: string;
    contentId?: Id<"document_draft_content">;
  },
): Promise<Id<"document_draft_content">> {
  const now = Date.now();
  const row = {
    draftId: params.draftId,
    documentId: params.documentId,
    projectId: params.projectId,
    userId: params.userId,
    title: params.title,
    content: params.content,
    updatedAt: now,
  };
  if (params.contentId) {
    try {
      // `replace` (not `get`+`patch`): we hold every field, so we overwrite
      // without first reading N bytes back — a single N-byte write.
      await ctx.db.replace(params.contentId, row);
      return params.contentId;
    } catch {
      // Stale pointer (row deleted out-of-band) — fall through to the
      // index-based upsert, which self-heals by returning the fresh id.
    }
  }
  const existing = await ctx.db
    .query("document_draft_content")
    .withIndex("by_draftId", (q) => q.eq("draftId", params.draftId))
    .unique();
  if (existing) {
    await ctx.db.replace(existing._id, row);
    return existing._id;
  }
  return await ctx.db.insert("document_draft_content", row);
}

/**
 * Deletes a draft's content row. Used by the single-draft `remove` path
 * (per-project / account cascades drain via their own `by_projectId` /
 * `by_userId` sweeps).
 */
export async function deleteDraftContent(
  ctx: MutationCtx,
  draftId: Id<"document_drafts">,
): Promise<void> {
  const existing = await ctx.db
    .query("document_draft_content")
    .withIndex("by_draftId", (q) => q.eq("draftId", draftId))
    .unique();
  if (existing) await ctx.db.delete(existing._id);
}
