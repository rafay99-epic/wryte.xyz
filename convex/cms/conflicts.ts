/**
 * Sync conflicts — created when `startBulkImport`'s diff-before-enqueue
 * logic detects that BOTH GitHub and Convex have changed for the same
 * file since the last sync. The action snapshots GitHub's content (so
 * the diff is stable even if the user edits the doc later) and writes
 * a row here; the project banner and per-file resolution UI subscribe
 * to it.
 *
 * Resolution paths all bump `documents.githubSyncedAt` so the next sync
 * starts from a clean baseline:
 *  - `resolveUseGithub`  → overwrite doc content with remote
 *  - `resolveKeepConvex` → leave doc content, accept remote SHA as the
 *                          new baseline (next sync won't reflag)
 *  - `resolveMerge`      → caller submits merged content
 *
 * Auth model: every public query/mutation verifies the user owns the
 * project the conflict belongs to before reading or mutating.
 */
import { v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import { internalMutation, mutation, query } from "../_generated/server";
import { getAuthedUserOrNull, getCurrentUser } from "../_lib/auth";
import { getRateLimitKey, rateLimiter } from "../_lib/rateLimits";

/**
 * Internal-only writer called by `startBulkImport` during conflict
 * detection. Idempotent on (documentId, unresolved) — if a previous
 * conflict for the same doc is still open, we update the snapshot in
 * place rather than spamming a second row, so the banner count
 * matches the file count even if the user resyncs while a conflict is
 * still pending.
 */
export const _create = internalMutation({
  args: {
    projectId: v.id("projects"),
    documentId: v.id("documents"),
    userId: v.id("users"),
    githubPath: v.string(),
    remoteSha: v.string(),
    remoteContent: v.string(),
    remoteFrontmatter: v.optional(v.string()),
    localContentSnapshot: v.string(),
    localFrontmatterSnapshot: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<Id<"sync_conflicts">> => {
    const now = Date.now();

    const existing = await ctx.db
      .query("sync_conflicts")
      .withIndex("by_documentId", (q) => q.eq("documentId", args.documentId))
      .collect();
    const openConflict = existing.find((c) => c.resolvedAt === undefined);

    if (openConflict) {
      const patch: Record<string, unknown> = {
        remoteSha: args.remoteSha,
        remoteContent: args.remoteContent,
        localContentSnapshot: args.localContentSnapshot,
        detectedAt: now,
      };
      if (args.remoteFrontmatter !== undefined) {
        patch["remoteFrontmatter"] = args.remoteFrontmatter;
      }
      if (args.localFrontmatterSnapshot !== undefined) {
        patch["localFrontmatterSnapshot"] = args.localFrontmatterSnapshot;
      }
      await ctx.db.patch(openConflict._id, patch);
      return openConflict._id;
    }

    const insertData: {
      projectId: Id<"projects">;
      documentId: Id<"documents">;
      userId: Id<"users">;
      githubPath: string;
      remoteSha: string;
      remoteContent: string;
      remoteFrontmatter?: string;
      localContentSnapshot: string;
      localFrontmatterSnapshot?: string;
      detectedAt: number;
    } = {
      projectId: args.projectId,
      documentId: args.documentId,
      userId: args.userId,
      githubPath: args.githubPath,
      remoteSha: args.remoteSha,
      remoteContent: args.remoteContent,
      localContentSnapshot: args.localContentSnapshot,
      detectedAt: now,
    };
    if (args.remoteFrontmatter !== undefined) {
      insertData.remoteFrontmatter = args.remoteFrontmatter;
    }
    if (args.localFrontmatterSnapshot !== undefined) {
      insertData.localFrontmatterSnapshot = args.localFrontmatterSnapshot;
    }
    return await ctx.db.insert("sync_conflicts", insertData);
  },
});

/**
 * Unresolved conflicts for a project, newest first. Powers the
 * persistent banner on the project dashboard and the conflicts tab in
 * the bulk-import completion dialog.
 */
export const listForProject = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    const user = await getAuthedUserOrNull(ctx);
    if (!user) return [];

    const project = await ctx.db.get(args.projectId);
    if (!project || project.userId !== user._id) return [];

    const conflicts = await ctx.db
      .query("sync_conflicts")
      .withIndex("by_projectId_unresolved", (q) =>
        q.eq("projectId", args.projectId).eq("resolvedAt", undefined),
      )
      .collect();

    return conflicts
      .sort((a, b) => b.detectedAt - a.detectedAt)
      .map((c) => ({
        _id: c._id,
        documentId: c.documentId,
        githubPath: c.githubPath,
        detectedAt: c.detectedAt,
      }));
  },
});

/**
 * Returns the open conflict for a document if one exists, else null.
 * Powers the editor's "this file is locked until you resolve the
 * conflict" banner so we don't have to re-render the entire
 * `listForProject` payload when the editor only needs one row.
 *
 * Returns `null` for unauthorized callers (rather than throwing) so the
 * editor's reactive subscription degrades cleanly.
 */
export const getOpenByDocument = query({
  args: { documentId: v.id("documents") },
  handler: async (ctx, args) => {
    const user = await getAuthedUserOrNull(ctx);
    if (!user) return null;

    const document = await ctx.db.get(args.documentId);
    if (!document) return null;
    const project = await ctx.db.get(document.projectId);
    if (!project || project.userId !== user._id) return null;

    const conflicts = await ctx.db
      .query("sync_conflicts")
      .withIndex("by_documentId", (q) => q.eq("documentId", args.documentId))
      .collect();
    const open = conflicts.find((c) => c.resolvedAt === undefined);
    if (!open) return null;
    return {
      _id: open._id,
      projectId: open.projectId,
      githubPath: open.githubPath,
      detectedAt: open.detectedAt,
    };
  },
});

/**
 * Full conflict payload for the side-by-side diff view. Returns null
 * (not throws) for missing/unauthorized so the UI renders a friendly
 * "not found" state when the user navigates after the conflict was
 * already resolved.
 */
export const get = query({
  args: { conflictId: v.id("sync_conflicts") },
  handler: async (ctx, args) => {
    const user = await getAuthedUserOrNull(ctx);
    if (!user) return null;

    const conflict = await ctx.db.get(args.conflictId);
    if (!conflict) return null;

    const project = await ctx.db.get(conflict.projectId);
    if (!project || project.userId !== user._id) return null;

    const document = await ctx.db.get(conflict.documentId);
    if (!document) return null;

    return {
      conflict,
      document: {
        _id: document._id,
        title: document.title,
        slug: document.slug,
        content: document.content,
        frontmatter: document.frontmatter,
        githubSha: document.githubSha,
        githubSyncedAt: document.githubSyncedAt,
        updatedAt: document.updatedAt,
      },
    };
  },
});

/** Verifies the user owns the project this conflict belongs to and the
 *  conflict is still open. Returns the conflict + document or throws. */
async function loadOpenConflictForOwner(
  ctx: {
    auth: import("../_generated/server").MutationCtx["auth"];
    db: import("../_generated/server").MutationCtx["db"];
  },
  conflictId: Id<"sync_conflicts">,
): Promise<{ conflict: Doc<"sync_conflicts">; doc: Doc<"documents"> }> {
  const user = await getCurrentUser(ctx);
  const conflict = await ctx.db.get(conflictId);
  if (!conflict) throw new Error("Conflict not found");

  if (conflict.resolvedAt !== undefined) {
    throw new Error("Conflict already resolved");
  }

  const project = await ctx.db.get(conflict.projectId);
  if (!project) throw new Error("Project not found");
  if (project.userId !== user._id) {
    throw new Error("Unauthorized: you do not own this conflict");
  }

  const doc = await ctx.db.get(conflict.documentId);
  if (!doc) throw new Error("Document not found");

  return { conflict, doc };
}

/**
 * "Take what's on GitHub" — overwrites the doc with the remote
 * snapshot we captured at detection time. Bumps `githubSyncedAt` so
 * the resolution sticks against the next sync.
 */
export const resolveUseGithub = mutation({
  args: { conflictId: v.id("sync_conflicts") },
  handler: async (ctx, args) => {
    const key = await getRateLimitKey(ctx);
    await rateLimiter.limit(ctx, "conflicts:resolve", { key, throws: true });

    const { conflict } = await loadOpenConflictForOwner(ctx, args.conflictId);
    const now = Date.now();

    const patch: Record<string, unknown> = {
      content: conflict.remoteContent,
      githubSha: conflict.remoteSha,
      githubSyncedAt: now,
      updatedAt: now,
    };
    if (conflict.remoteFrontmatter !== undefined) {
      patch["frontmatter"] = conflict.remoteFrontmatter;
    }

    await ctx.db.patch(conflict.documentId, patch);
    await ctx.db.patch(conflict._id, {
      resolvedAt: now,
      resolution: "github" as const,
    });
  },
});

/**
 * "Keep my Convex version" — doesn't touch the doc content; just
 * adopts the remote SHA as the new sync baseline so the next sync
 * doesn't re-flag the same conflict. The user is implicitly saying
 * "I know GitHub changed, but I'm overriding with my version on the
 * next publish."
 */
export const resolveKeepConvex = mutation({
  args: { conflictId: v.id("sync_conflicts") },
  handler: async (ctx, args) => {
    const key = await getRateLimitKey(ctx);
    await rateLimiter.limit(ctx, "conflicts:resolve", { key, throws: true });

    const { conflict } = await loadOpenConflictForOwner(ctx, args.conflictId);
    const now = Date.now();

    await ctx.db.patch(conflict.documentId, {
      githubSha: conflict.remoteSha,
      githubSyncedAt: now,
      updatedAt: now,
    });
    await ctx.db.patch(conflict._id, {
      resolvedAt: now,
      resolution: "convex" as const,
    });
  },
});

/**
 * "I merged it myself" — caller submits the merged content (and
 * optionally frontmatter). We trust the submitted text and stamp the
 * remote SHA as the new baseline so the next sync sees this as a
 * fast-forward against GitHub.
 */
export const resolveMerge = mutation({
  args: {
    conflictId: v.id("sync_conflicts"),
    mergedContent: v.string(),
    mergedFrontmatter: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const key = await getRateLimitKey(ctx);
    await rateLimiter.limit(ctx, "conflicts:resolve", { key, throws: true });

    const { conflict } = await loadOpenConflictForOwner(ctx, args.conflictId);
    const now = Date.now();

    const patch: Record<string, unknown> = {
      content: args.mergedContent,
      githubSha: conflict.remoteSha,
      githubSyncedAt: now,
      updatedAt: now,
    };
    if (args.mergedFrontmatter !== undefined) {
      patch["frontmatter"] = args.mergedFrontmatter;
    }

    await ctx.db.patch(conflict.documentId, patch);
    await ctx.db.patch(conflict._id, {
      resolvedAt: now,
      resolution: "merge" as const,
    });
  },
});

/**
 * Discard a conflict without applying either side. Used when the
 * underlying document has been deleted or the user no longer cares.
 * The next sync will re-detect if both sides are still in conflict.
 */
export const dismiss = mutation({
  args: { conflictId: v.id("sync_conflicts") },
  handler: async (ctx, args) => {
    const key = await getRateLimitKey(ctx);
    await rateLimiter.limit(ctx, "conflicts:resolve", { key, throws: true });

    const user = await getCurrentUser(ctx);
    const conflict = await ctx.db.get(args.conflictId);
    if (!conflict) return;
    const project = await ctx.db.get(conflict.projectId);
    if (!project || project.userId !== user._id) {
      throw new Error("Unauthorized");
    }
    await ctx.db.delete(args.conflictId);
  },
});
