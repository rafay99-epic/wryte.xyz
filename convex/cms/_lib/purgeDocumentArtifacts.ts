/**
 * Per-document cascade purge — the counterpart to `projects._wipeProjectChunk`
 * (project-wide) but scoped to a single document. Covers every table that
 * `trash.ts`'s hard-delete paths (`permanentDelete`, `emptyTrash`,
 * `_cleanupExpired`) previously left orphaned forever: drafts, snapshots,
 * sync conflicts, publish history (plus their content side-tables), research
 * notes, share links, and any leftover scheduled-publish jobs. See the
 * "Cascade gap" problem in `.frugal-fable/convex-cost-audit/DESIGN.md`.
 *
 * Callers still own deleting `document_content` (via `deleteContent`) and the
 * `documents` row itself — this helper only covers the tables that weren't
 * already handled at the call sites.
 *
 * Budget model: every table below shares one `PER_CALL_CAP` budget (mirrors
 * the pattern in `_wipeProjectChunk`) so a single invocation can never risk
 * Convex's per-transaction read/write limits, even for a document with an
 * unusually long history of drafts/snapshots/publishes. Content rows are
 * always drained before their parent metadata rows so a budget-exhausted
 * call never leaves a content row pointing at a deleted parent.
 *
 * `done` is computed from a fresh set of `.take(1)` existence checks after
 * the deletions (mirrors `countProjectRemaining`) rather than from the
 * budget counter, so it's accurate even when a table wasn't reached this
 * call because an earlier table consumed the whole budget. Callers should
 * keep invoking this (it's idempotent — each call just resumes draining
 * whatever remains via the same indexes) until `done` is true before
 * deleting the document's own row.
 */
import type { Id } from "../../_generated/dataModel";
import type { MutationCtx } from "../../_generated/server";
import {
  drainDocumentLinksForDoc,
  hasRemainingLinksForDoc,
} from "./documentLinks";

/** Shared across every table drained below. Chosen so even the worst-case
 *  single call (all budget spent on one table) stays comfortably inside
 *  Convex's mutation transaction limits. */
const PER_CALL_CAP = 200;

export async function purgeDocumentArtifacts(
  ctx: MutationCtx,
  documentId: Id<"documents">,
  /**
   * Optional tighter cap for callers that purge MULTIPLE documents in one
   * transaction (emptyTrash, the cleanup cron): they pass their remaining
   * shared artifact budget so the stacked purges can't multiply up to
   * N_docs × PER_CALL_CAP reads/writes and breach transaction limits.
   * Always clamped to PER_CALL_CAP.
   */
  cap: number = PER_CALL_CAP,
): Promise<{ done: boolean; deleted: number }> {
  let budget = Math.max(0, Math.min(cap, PER_CALL_CAP));
  let deleted = 0;

  /* 1. document_draft_content — drained before `document_drafts` so a
   *    budget-exhausted call never leaves an orphaned content row. */
  if (budget > 0) {
    const rows = await ctx.db
      .query("document_draft_content")
      .withIndex("by_documentId", (q) => q.eq("documentId", documentId))
      .take(budget);
    for (const row of rows) {
      await ctx.db.delete(row._id);
      budget--;
      deleted++;
    }
  }

  /* 2. document_drafts */
  if (budget > 0) {
    const rows = await ctx.db
      .query("document_drafts")
      .withIndex("by_documentId", (q) => q.eq("documentId", documentId))
      .take(budget);
    for (const row of rows) {
      await ctx.db.delete(row._id);
      budget--;
      deleted++;
    }
  }

  /* 3. document_snapshot_content — same ordering rationale as (1). */
  if (budget > 0) {
    const rows = await ctx.db
      .query("document_snapshot_content")
      .withIndex("by_documentId", (q) => q.eq("documentId", documentId))
      .take(budget);
    for (const row of rows) {
      await ctx.db.delete(row._id);
      budget--;
      deleted++;
    }
  }

  /* 4. document_snapshots */
  if (budget > 0) {
    const rows = await ctx.db
      .query("document_snapshots")
      .withIndex("by_documentId", (q) => q.eq("documentId", documentId))
      .take(budget);
    for (const row of rows) {
      await ctx.db.delete(row._id);
      budget--;
      deleted++;
    }
  }

  /* 5. sync_conflicts — resolved rows already had their content stripped
   *    by `conflicts.ts` on resolve, so these are just tiny audit rows by
   *    the time the parent document is gone. */
  if (budget > 0) {
    const rows = await ctx.db
      .query("sync_conflicts")
      .withIndex("by_documentId", (q) => q.eq("documentId", documentId))
      .take(budget);
    for (const row of rows) {
      await ctx.db.delete(row._id);
      budget--;
      deleted++;
    }
  }

  /* 6. publish_history_content — drained before `publish_history`. */
  if (budget > 0) {
    const rows = await ctx.db
      .query("publish_history_content")
      .withIndex("by_documentId", (q) => q.eq("documentId", documentId))
      .take(budget);
    for (const row of rows) {
      await ctx.db.delete(row._id);
      budget--;
      deleted++;
    }
  }

  /* 7. publish_history */
  if (budget > 0) {
    const rows = await ctx.db
      .query("publish_history")
      .withIndex("by_documentId", (q) => q.eq("documentId", documentId))
      .take(budget);
    for (const row of rows) {
      await ctx.db.delete(row._id);
      budget--;
      deleted++;
    }
  }

  /* 8. document_research */
  if (budget > 0) {
    const rows = await ctx.db
      .query("document_research")
      .withIndex("by_documentId", (q) => q.eq("documentId", documentId))
      .take(budget);
    for (const row of rows) {
      await ctx.db.delete(row._id);
      budget--;
      deleted++;
    }
  }

  /* 9. share_links */
  if (budget > 0) {
    const rows = await ctx.db
      .query("share_links")
      .withIndex("by_documentId", (q) => q.eq("documentId", documentId))
      .take(budget);
    for (const row of rows) {
      await ctx.db.delete(row._id);
      budget--;
      deleted++;
    }
  }

  /* 10. scheduled_publishes — mirrors the semantics of
   *     `cascadeDeleteScheduledPublishesForDoc` in `cms/documents.ts`
   *     (deletes every row regardless of status, no filter). A trashed
   *     document should already have zero rows here — soft-delete cancels
   *     them at trash time — but this is the last line of defense for any
   *     that slipped through. */
  if (budget > 0) {
    const rows = await ctx.db
      .query("scheduled_publishes")
      .withIndex("by_documentId", (q) => q.eq("documentId", documentId))
      .take(budget);
    for (const row of rows) {
      await ctx.db.delete(row._id);
      budget--;
      deleted++;
    }
  }

  /* 11. document_links — drain edges in BOTH directions (rows where this
   *     document is the source AND rows where it is the target), sharing the
   *     same budget so a heavily-linked doc can't breach transaction limits. */
  if (budget > 0) {
    const { deleted: linksDeleted } = await drainDocumentLinksForDoc(
      ctx,
      documentId,
      budget,
    );
    budget -= linksDeleted;
    deleted += linksDeleted;
  }

  const done = !(await hasRemainingArtifacts(ctx, documentId));
  return { done, deleted };
}

/** Cheap post-check (one `.take(1)` per table) so `done` is accurate even
 *  when the budget ran out partway through — mirrors `countProjectRemaining`
 *  in `projects.ts`. */
async function hasRemainingArtifacts(
  ctx: MutationCtx,
  documentId: Id<"documents">,
): Promise<boolean> {
  const heads = await Promise.all([
    ctx.db
      .query("document_draft_content")
      .withIndex("by_documentId", (q) => q.eq("documentId", documentId))
      .take(1),
    ctx.db
      .query("document_drafts")
      .withIndex("by_documentId", (q) => q.eq("documentId", documentId))
      .take(1),
    ctx.db
      .query("document_snapshot_content")
      .withIndex("by_documentId", (q) => q.eq("documentId", documentId))
      .take(1),
    ctx.db
      .query("document_snapshots")
      .withIndex("by_documentId", (q) => q.eq("documentId", documentId))
      .take(1),
    ctx.db
      .query("sync_conflicts")
      .withIndex("by_documentId", (q) => q.eq("documentId", documentId))
      .take(1),
    ctx.db
      .query("publish_history_content")
      .withIndex("by_documentId", (q) => q.eq("documentId", documentId))
      .take(1),
    ctx.db
      .query("publish_history")
      .withIndex("by_documentId", (q) => q.eq("documentId", documentId))
      .take(1),
    ctx.db
      .query("document_research")
      .withIndex("by_documentId", (q) => q.eq("documentId", documentId))
      .take(1),
    ctx.db
      .query("share_links")
      .withIndex("by_documentId", (q) => q.eq("documentId", documentId))
      .take(1),
    ctx.db
      .query("scheduled_publishes")
      .withIndex("by_documentId", (q) => q.eq("documentId", documentId))
      .take(1),
  ]);
  if (heads.some((rows) => rows.length > 0)) return true;
  // document_links has no by_documentId index (edges are directional), so
  // check both directions via the dedicated helper.
  return await hasRemainingLinksForDoc(ctx, documentId);
}
