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
import type { Doc, Id } from "../_generated/dataModel";
import { internalMutation, mutation, query } from "../_generated/server";
import { getAuthedUserOrNull, getCurrentUser } from "../_lib/auth";
import { getRateLimitKey, rateLimiter } from "../_lib/rateLimits";

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

    const docs = await ctx.db
      .query("documents")
      .withIndex("by_projectId", (q) => q.eq("projectId", args.projectId))
      .collect();

    const trashed = docs.filter((d) => d.trashedAt !== undefined);
    trashed.sort((a, b) => (b.trashedAt ?? 0) - (a.trashedAt ?? 0));

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
  const user = await getCurrentUser(ctx);
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
  handler: async (ctx, args) => {
    const key = await getRateLimitKey(ctx);
    await rateLimiter.limit(ctx, "documents:restoreFromTrash", {
      key,
      throws: true,
    });

    const doc = await loadOwnedTrashedDoc(ctx, args.documentId);

    await ctx.db.patch(doc._id, {
      // Convex patches don't take `undefined` to clear optionals; use the
      // null-then-omit trick: we replace with `trashedAt: undefined` via
      // setting it explicitly. Convex accepts `undefined` for optional
      // schema fields in patch payloads.
      trashedAt: undefined,
      updatedAt: Date.now(),
    });
  },
});

/**
 * Permanently deletes a trashed doc. No undo. Use only from the trash
 * view after explicit user confirmation.
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
    await ctx.db.delete(doc._id);
  },
});

/**
 * Empties an entire project's trash. Authoritative permission check
 * happens once; then we iterate the trash list and hard-delete.
 * Capped at 200 deletions per call to stay under Convex's mutation
 * limits — the UI should warn if there's more.
 */
export const emptyTrash = mutation({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args): Promise<{ deleted: number }> => {
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

    const docs = await ctx.db
      .query("documents")
      .withIndex("by_projectId", (q) => q.eq("projectId", args.projectId))
      .collect();

    const trashed = docs.filter((d) => d.trashedAt !== undefined).slice(0, 200);
    for (const d of trashed) {
      await ctx.db.delete(d._id);
    }
    return { deleted: trashed.length };
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
 * Per-run cap of 500 deletions to stay safely inside Convex's
 * mutation transaction budget. Anything beyond rolls into the next
 * day's run; trash cleanup isn't urgent enough to need workpool
 * fan-out.
 *
 * Cost model: 1 projects.collect() + 1 indexed query per project
 * (skipping "Never" retention projects) + N db.delete() calls
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
  }> => {
    const now = Date.now();
    const PER_RUN_CAP = 500;
    let deleted = 0;
    let projectsSkipped = 0;

    const projects = await ctx.db.query("projects").collect();
    for (const project of projects) {
      if (deleted >= PER_RUN_CAP) break;
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
        .collect();

      for (const d of expired) {
        if (deleted >= PER_RUN_CAP) break;
        await ctx.db.delete(d._id);
        deleted += 1;
      }
    }

    return {
      projectsScanned: projects.length - projectsSkipped,
      projectsSkipped,
      deleted,
    };
  },
});
