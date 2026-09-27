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

export const restore = mutation({
  args: { documentId: v.id("documents") },
  handler: async (ctx, args) =>
    await restoreTrashedForUser(
      ctx,
      await getCurrentUser(ctx),
      args.documentId,
    ),
});

export async function restoreTrashedForUser(
  ctx: MutationCtx,
  user: Doc<"users">,
  documentId: Id<"documents">,
) {
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

export const _finishPermanentDelete = internalMutation({
  args: { documentId: v.id("documents") },
  handler: async (ctx, args) => {
    const doc = await ctx.db.get(args.documentId);
    if (!doc) return;

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

const EMPTY_TRASH_DOC_BATCH = 25;

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

const NEVER_DELETE_THRESHOLD_DAYS = 36500;

const PROJECT_PAGE_SIZE = 100;

export const _cleanupExpired = internalMutation({
  args: { cursor: v.optional(v.union(v.string(), v.null())) },
  handler: async (
    ctx,
    args,
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

    const cursor = args.cursor ?? null;
    const {
      page: projects,
      isDone,
      continueCursor,
    } = await ctx.db
      .query("projects")
      .paginate({ numItems: PROJECT_PAGE_SIZE, cursor });
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

    const capped = deleted >= PER_RUN_CAP || artifactBudget <= 0;
    if (capped) {
      await ctx.scheduler.runAfter(0, internal.cms.trash._cleanupExpired, {
        cursor,
      });
    } else if (!isDone) {
      await ctx.scheduler.runAfter(0, internal.cms.trash._cleanupExpired, {
        cursor: continueCursor,
      });
    }

    return {
      projectsScanned: projects.length - projectsSkipped,
      projectsSkipped,
      deleted,
      pending,
    };
  },
});
