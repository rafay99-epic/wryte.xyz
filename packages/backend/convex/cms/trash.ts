/**
 * Trash subsystem for soft-deleted documents.
 *
 * Every doc deletion (single, bulk-local, workpool bulk) sets
 * `documents.trashedAt` instead of hard-deleting. The trash view
 * lists those docs and offers Restore / Permanent delete actions.
 * A daily cron drains trash older than the project's
 * `trashRetentionDays` (default 30) — see
 * `_cleanupExpired`.
 *
 * Cascade contract: when we soft-delete, we still cancel any pending
 * scheduled publishes for the doc — restoring won't bring them back.
 * Users have to re-schedule on restore. That's intentional: a
 * trashed doc with an active timer would fire and publish a
 * just-restored stale draft.
 */
import { v } from "convex/values";
import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { internalMutation, mutation, query } from "../_generated/server";
import { getAuthedUserOrNull, getCurrentUser } from "../_lib/auth";
import { adjustDocumentCount } from "../_lib/documentCount";
import {
  scheduleStatusChange,
  scheduleWordActivity,
} from "../_lib/projectStats";
import { getRateLimitKey, rateLimiter } from "../_lib/rateLimits";
import { deleteContent } from "./_lib/documentContent";
import { purgeDocumentArtifacts } from "./_lib/purgeDocumentArtifacts";

const DEFAULT_RETENTION_DAYS = 30;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Lists trashed docs for a project, ordered by `trashedAt` desc
 * (newest deletion first). Returns the lite shape the trash table
 * needs — title, slug, path, trashedAt, the project's retention
 * (so the UI can render "expires in N days").
 */
export const listByProject = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    const user = await getAuthedUserOrNull(ctx);
    if (!user) return null;

    const project = await ctx.db.get(args.projectId);
    if (!project || project.userId !== user._id) return null;

    const trashed = await ctx.db
      .query("documents")
      .withIndex("by_projectId_and_trashedAt", (q) =>
        q.eq("projectId", args.projectId).gt("trashedAt", 0),
      )
      .order("desc")
      .take(200);

    return {
      retentionDays: project.trashRetentionDays ?? DEFAULT_RETENTION_DAYS,
      items: trashed.map((d) => ({
        _id: d._id,
        title: d.title,
        slug: d.slug,
        githubPath: d.githubPath,
        trashedAt: d.trashedAt,
        updatedAt: d.updatedAt,
      })),
    };
  },
});

async function loadOwnedTrashedDoc(
  ctx: {
    auth: import("../_generated/server").MutationCtx["auth"];
    db: import("../_generated/server").MutationCtx["db"];
  },
  documentId: Id<"documents">,
): Promise<Doc<"documents">> {
  return await loadTrashedDocForUser(
    ctx,
    await getCurrentUser(ctx),
    documentId,
  );
}

/**
 * Ownership-checked read of a trashed document with the actor passed in
 * explicitly. Shared with the MCP handler, which has no `ctx.auth` — see
 * `_lib/auth.ts → requireCaller`.
 */
async function loadTrashedDocForUser(
  ctx: { db: import("../_generated/server").MutationCtx["db"] },
  user: Doc<"users">,
  documentId: Id<"documents">,
): Promise<Doc<"documents">> {
  const doc = await ctx.db.get(documentId);
  if (!doc) throw new Error("Document not found");

  const project = await ctx.db.get(doc.projectId);
  if (!project) throw new Error("Project not found");
  if (project.userId !== user._id) {
    throw new Error("Unauthorized: you do not own this document");
  }
  if (doc.trashedAt === undefined) {
    throw new Error("Document is not in trash");
  }
  return doc;
}

/**
 * Restores a trashed doc by clearing `trashedAt`. We deliberately do
 * NOT recreate scheduled publishes — they were dropped at delete time
 * to avoid firing against a soft-deleted target, and re-creating them
 * now would publish a stale draft. Users re-schedule manually.
 */
export const restore = mutation({
  args: { documentId: v.id("documents") },
  handler: async (ctx, args) =>
    await restoreTrashedForUser(
      ctx,
      await getCurrentUser(ctx),
      args.documentId,
    ),
});

/** `restore`'s body with the actor passed in explicitly. Shared with the MCP
 *  handler, which has no `ctx.auth` — see `_lib/auth.ts → requireCaller`. */
export async function restoreTrashedForUser(
  ctx: MutationCtx,
  user: Doc<"users">,
  documentId: Id<"documents">,
) {
  {
    await rateLimiter.limit(ctx, "documents:restoreFromTrash", {
      key: user.tokenIdentifier,
      throws: true,
    });

    const doc = await loadTrashedDocForUser(ctx, user, documentId);

    await ctx.db.patch(doc._id, {
      trashedAt: undefined,
      updatedAt: Date.now(),
    });

    await adjustDocumentCount(ctx, doc.projectId, 1);
    await scheduleWordActivity(ctx, {
      userId: doc.userId,
      projectId: doc.projectId,
      wordCountDelta: doc.wordCount ?? 0,
    });
    await scheduleStatusChange(ctx, {
      projectId: doc.projectId,
      userId: doc.userId,
      oldStatus: null,
      newStatus: doc.status,
    });
  }
}

/**
 * Permanently deletes a trashed doc. No undo. Use only from the trash
 * view after explicit user confirmation.
 *
 * Also purges every dependent artifact row (drafts, snapshots, sync
 * conflicts, publish history, research notes, share links, scheduled
 * publishes — see `purgeDocumentArtifacts`) so a hard delete never
 * orphans them. `purgeDocumentArtifacts` is bounded per call; in the
 * (very unlikely) case a single document has more artifacts than one
 * call can drain, we schedule a continuation and leave the document row
 * in place until the purge finishes — deleting the parent before its
 * children are gone would make them unreachable forever.
 */
export const permanentDelete = mutation({
  args: { documentId: v.id("documents") },
  handler: async (ctx, args) => {
    const key = await getRateLimitKey(ctx);
    await rateLimiter.limit(ctx, "documents:permanentDelete", {
      key,
      throws: true,
    });

    const doc = await loadOwnedTrashedDoc(ctx, args.documentId);
    const { done } = await purgeDocumentArtifacts(ctx, doc._id);
    if (!done) {
      await ctx.scheduler.runAfter(
        0,
        internal.cms.trash._finishPermanentDelete,
        {
          documentId: doc._id,
        },
      );
      return;
    }
    await deleteContent(ctx, doc._id);
    await ctx.db.delete(doc._id);
  },
});

/**
 * Continuation for `permanentDelete` (and the batch paths below) when a
 * single document's artifacts exceed `purgeDocumentArtifacts`'s per-call
 * cap. Idempotent and self-resuming: each call just picks up wherever the
 * indexed queries left off, so re-scheduling itself is safe even under
 * retries.
 */
export const _finishPermanentDelete = internalMutation({
  args: { documentId: v.id("documents") },
  handler: async (ctx, args) => {
    const doc = await ctx.db.get(args.documentId);
    if (!doc) return; // Already fully deleted by a prior run.

    const { done } = await purgeDocumentArtifacts(ctx, args.documentId);
    if (!done) {
      await ctx.scheduler.runAfter(
        0,
        internal.cms.trash._finishPermanentDelete,
        {
          documentId: args.documentId,
        },
      );
      return;
    }
    await deleteContent(ctx, args.documentId);
    await ctx.db.delete(args.documentId);
  },
});

/**
 * Number of trashed documents processed per `emptyTrash` call. Reduced
 * from the pre-cascade 200: each document can now also drain up to
 * `PER_CALL_CAP` (see `purgeDocumentArtifacts`) dependent artifact rows,
 * so the outer document batch has to shrink to keep the whole mutation
 * safely inside Convex's transaction limits. The UI should warn (and
 * call again) if there's more.
 */
const EMPTY_TRASH_DOC_BATCH = 25;

/**
 * Empties an entire project's trash. Authoritative permission check
 * happens once; then we iterate the trash list and hard-delete, purging
 * each document's dependent artifacts first (see `permanentDelete`'s
 * doc comment for why a document whose purge doesn't finish in one call
 * is left in place with a scheduled continuation instead of being
 * deleted early).
 */
export const emptyTrash = mutation({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args): Promise<{ deleted: number; pending: number }> => {
    const key = await getRateLimitKey(ctx);
    await rateLimiter.limit(ctx, "documents:emptyTrash", {
      key,
      throws: true,
    });

    const user = await getCurrentUser(ctx);
    const project = await ctx.db.get(args.projectId);
    if (!project) throw new Error("Project not found");
    if (project.userId !== user._id) {
      throw new Error("Unauthorized: you do not own this project");
    }

    const trashed = await ctx.db
      .query("documents")
      .withIndex("by_projectId_and_trashedAt", (q) =>
        q.eq("projectId", args.projectId).gt("trashedAt", 0),
      )
      .take(EMPTY_TRASH_DOC_BATCH);
    let deleted = 0;
    let pending = 0;
    // Shared artifact budget across every document in this call. Without
    // it, 25 documents × PER_CALL_CAP artifact deletes each could stack
    // past Convex's per-transaction limits; docs not reached before the
    // budget runs out simply stay trashed for the next call.
    let artifactBudget = 300;
    for (const d of trashed) {
      if (artifactBudget <= 0) break;
      const { done, deleted: purged } = await purgeDocumentArtifacts(
        ctx,
        d._id,
        artifactBudget,
      );
      artifactBudget -= purged;
      if (!done) {
        await ctx.scheduler.runAfter(
          0,
          internal.cms.trash._finishPermanentDelete,
          {
            documentId: d._id,
          },
        );
        pending++;
        continue;
      }
      await deleteContent(ctx, d._id);
      await ctx.db.delete(d._id);
      deleted++;
    }
    return { deleted, pending };
  },
});

/**
 * Number of days that flips "Never auto-delete" — projects with at
 * least this retention never enter the cleanup loop's per-project
 * index query, which keeps the daily cron's cost ≈ O(active projects).
 */
const NEVER_DELETE_THRESHOLD_DAYS = 36500;

/**
 * Daily cron entry point. For each project, queries only the docs
 * whose `trashedAt` is in `(0, cutoff]` via the
 * `by_projectId_and_trashedAt` index — no full project scan, no
 * client-side filter over fresh docs. Projects with "Never" retention
 * are skipped before the query even fires.
 *
 * Per-run cap of 100 documents to stay safely inside Convex's mutation
 * transaction budget. Reduced from the pre-cascade 500: each document
 * can now also drain up to `PER_CALL_CAP` (see `purgeDocumentArtifacts`)
 * dependent artifact rows, not just its own two rows, so the per-run
 * document cap has to shrink accordingly. Anything beyond rolls into
 * the next day's run; trash cleanup isn't urgent enough to need
 * workpool fan-out.
 *
 * Cost model: 1 projects.collect() + 1 indexed query per project
 * (skipping "Never" retention projects) + N purge-then-delete calls
 * bounded by PER_RUN_CAP. Cheap even at thousands of projects.
 */
export const _cleanupExpired = internalMutation({
  args: {},
  handler: async (
    ctx,
  ): Promise<{
    projectsScanned: number;
    projectsSkipped: number;
    deleted: number;
    pending: number;
  }> => {
    const now = Date.now();
    const PER_RUN_CAP = 100;
    let deleted = 0;
    let pending = 0;
    let projectsSkipped = 0;

    const projects = await ctx.db.query("projects").take(1000);
    // Shared artifact budget across every document this run — same
    // rationale as `emptyTrash`: stacked per-document purges must not
    // multiply past transaction limits. Docs not reached roll into
    // tomorrow's run.
    let artifactBudget = 400;

    for (const project of projects) {
      if (deleted >= PER_RUN_CAP || artifactBudget <= 0) break;
      const retentionDays =
        project.trashRetentionDays ?? DEFAULT_RETENTION_DAYS;
      if (retentionDays >= NEVER_DELETE_THRESHOLD_DAYS) {
        projectsSkipped += 1;
        continue;
      }
      const cutoff = now - retentionDays * MS_PER_DAY;

      // Range query: only expired trashed docs are scanned. `gt(0)`
      // filters out the always-active rows whose `trashedAt` is
      // undefined (undefined sorts as smallest in Convex indexes);
      // `lte(cutoff)` caps to expired ones.
      const expired = await ctx.db
        .query("documents")
        .withIndex("by_projectId_and_trashedAt", (q) =>
          q
            .eq("projectId", project._id)
            .gt("trashedAt", 0)
            .lte("trashedAt", cutoff),
        )
        .take(PER_RUN_CAP);

      for (const d of expired) {
        if (deleted >= PER_RUN_CAP || artifactBudget <= 0) break;
        const { done, deleted: purged } = await purgeDocumentArtifacts(
          ctx,
          d._id,
          artifactBudget,
        );
        artifactBudget -= purged;
        if (!done) {
          await ctx.scheduler.runAfter(
            0,
            internal.cms.trash._finishPermanentDelete,
            { documentId: d._id },
          );
          pending += 1;
          continue;
        }
        await deleteContent(ctx, d._id);
        await ctx.db.delete(d._id);
        deleted += 1;
      }
    }

    return {
      projectsScanned: projects.length - projectsSkipped,
      projectsSkipped,
      deleted,
      pending,
    };
  },
});
