import type { WorkflowId } from "@convex-dev/workflow";
import { v } from "convex/values";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import {
  action,
  internalMutation,
  internalQuery,
  type MutationCtx,
  query,
} from "../_generated/server";
import { getAuthedUserOrNull } from "../_lib/auth";
import { getRateLimitKey, rateLimiter } from "../_lib/rateLimits";
import { NOTE_PURGE_BATCH, wipeNoteRows } from "../cms/notes/_lib/purge";

const NOTE_WIPE_BATCH = NOTE_PURGE_BATCH;

import { listProjectVaultIds, wipeProjectRows } from "../cms/projects";
import { publishWorkflowManager } from "../integrations/scheduling";

export const selfDestructPreview = query({
  args: {},
  handler: async (ctx) => {
    const user = await getAuthedUserOrNull(ctx);
    if (!user) return null;

    const projects = await ctx.db
      .query("projects")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .take(100);

    const documents = await ctx.db
      .query("documents")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .take(5000);

    const mediaUsageRows = await ctx.db
      .query("mediaUsage")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .take(100);
    let mediaCount = 0;
    for (const usage of mediaUsageRows) {
      mediaCount += usage.fileCount;
    }

    const mediaErrorSample = await ctx.db
      .query("mediaErrorLog")
      .withIndex("by_userId_and_createdAt", (q) => q.eq("userId", user._id))
      .take(1);
    const mediaErrorCount = mediaErrorSample.length > 0 ? 1 : 0;

    const scheduled: Array<{
      documentId: Id<"documents">;
      documentTitle: string;
      scheduledAt: number;
      status: "pending" | "processing";
    }> = [];
    for (const doc of documents) {
      const rows = await ctx.db
        .query("scheduled_publishes")
        .withIndex("by_documentId", (q) => q.eq("documentId", doc._id))
        .take(10);
      for (const row of rows) {
        if (row.status === "pending" || row.status === "processing") {
          scheduled.push({
            documentId: doc._id,
            documentTitle: doc.title,
            scheduledAt: row.scheduledAt,
            status: row.status,
          });
        }
      }
    }
    scheduled.sort((a, b) => a.scheduledAt - b.scheduledAt);

    const credentialRows = await ctx.db
      .query("mediaCredentials")
      .withIndex("by_userId_and_provider", (q) => q.eq("userId", user._id))
      .take(20);

    const aiCredentialRows = await ctx.db
      .query("aiCredentials")
      .withIndex("by_userId_and_provider", (q) => q.eq("userId", user._id))
      .take(20);

    return {
      projectCount: projects.length,
      documentCount: documents.length,
      mediaCount,
      mediaErrorCount,
      vaultCredentialCount: credentialRows.length + aiCredentialRows.length,
      hasGithubVault: Boolean(user.githubVaultSecretId),
      scheduled,
    };
  },
});

export const selfDestruct = action({
  args: {},
  handler: async (
    ctx,
  ): Promise<{
    ok: true;
    summary: {
      projectsDeleted: number;
      documentsDeleted: number;
      mediaDeleted: number;
      scheduledCancelled: number;
      scheduledFailedToCancel: number;
      vaultDeleted: number;
      vaultOrphaned: number;
    };
  }> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const key = await getRateLimitKey(ctx);
    await rateLimiter.limit(ctx, "users:selfDestruct", { key, throws: true });

    const user = await ctx.runQuery(internal.account.users.internalGetByToken, {
      tokenIdentifier: identity.tokenIdentifier,
    });
    if (!user) throw new Error("User not found");

    const cancellationTargets = await ctx.runQuery(
      internal.account.selfDestruct._listCancellationTargets,
      { userId: user._id },
    );
    let scheduledCancelled = 0;
    let scheduledFailedToCancel = 0;
    for (const target of cancellationTargets) {
      if (!target.workflowId) continue;
      try {
        await publishWorkflowManager.cancel(
          ctx,
          target.workflowId as WorkflowId,
        );
        scheduledCancelled++;
      } catch {
        scheduledFailedToCancel++;
      }
    }

    const vaultIds = await ctx.runQuery(
      internal.account.selfDestruct._listVaultIds,
      {
        userId: user._id,
      },
    );
    let vaultDeleted = 0;
    let vaultOrphaned = 0;
    for (const id of vaultIds) {
      try {
        await ctx.runAction(internal.integrations.secretStore._delete, { id });
        vaultDeleted++;
      } catch {
        vaultOrphaned++;
      }
    }

    let projectsDeleted = 0;
    let documentsDeleted = 0;
    let mediaDeleted = 0;
    for (let i = 0; i < 200; i++) {
      const chunk = await ctx.runMutation(
        internal.account.selfDestruct._wipeChunk,
        {
          userId: user._id,
          batch: 200,
        },
      );
      projectsDeleted += chunk.projectsDeleted;
      documentsDeleted += chunk.documentsDeleted;
      mediaDeleted += chunk.mediaDeleted;
      if (chunk.remaining === 0) break;
    }

    await ctx.runMutation(internal.account.selfDestruct._resetUserRow, {
      userId: user._id,
    });

    return {
      ok: true,
      summary: {
        projectsDeleted,
        documentsDeleted,
        mediaDeleted,
        scheduledCancelled,
        scheduledFailedToCancel,
        vaultDeleted,
        vaultOrphaned,
      },
    };
  },
});

export const _listCancellationTargets = internalQuery({
  args: { userId: v.id("users") },
  handler: async (
    ctx,
    args,
  ): Promise<
    Array<{
      _id: Id<"scheduled_publishes">;
      workflowId?: string;
      status: "pending" | "processing" | "completed" | "failed";
    }>
  > => {
    const documents = await ctx.db
      .query("documents")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .take(5000);
    const out: Array<{
      _id: Id<"scheduled_publishes">;
      workflowId?: string;
      status: "pending" | "processing" | "completed" | "failed";
    }> = [];
    for (const doc of documents) {
      const rows = await ctx.db
        .query("scheduled_publishes")
        .withIndex("by_documentId", (q) => q.eq("documentId", doc._id))
        .take(10);
      for (const row of rows) {
        if (row.status === "pending" || row.status === "processing") {
          const entry: {
            _id: Id<"scheduled_publishes">;
            workflowId?: string;
            status: "pending" | "processing" | "completed" | "failed";
          } = { _id: row._id, status: row.status };
          if (row.workflowId !== undefined) entry.workflowId = row.workflowId;
          out.push(entry);
        }
      }
    }
    return out;
  },
});

export const _listVaultIds = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, args): Promise<string[]> => {
    const ids = new Set<string>();

    const user = await ctx.db.get(args.userId);
    if (user?.githubVaultSecretId) ids.add(user.githubVaultSecretId);

    const userCreds = await Promise.all([
      ctx.db
        .query("mediaCredentials")
        .withIndex("by_userId_and_provider", (q) => q.eq("userId", args.userId))
        .take(20),
      ctx.db
        .query("aiCredentials")
        .withIndex("by_userId_and_provider", (q) => q.eq("userId", args.userId))
        .take(20),
      ctx.db
        .query("socialCredentials")
        .withIndex("by_userId_and_provider", (q) => q.eq("userId", args.userId))
        .take(20),
      ctx.db
        .query("syndicationCredentials")
        .withIndex("by_userId_and_provider", (q) => q.eq("userId", args.userId))
        .take(20),
    ]);
    for (const rows of userCreds) {
      for (const c of rows) {
        if (c.vaultSecretId) ids.add(c.vaultSecretId);
      }
    }

    const userLevelMediaCreds = await ctx.db
      .query("mediaCredentials")
      .withIndex("by_userId_and_projectId_and_provider", (q) =>
        q.eq("userId", args.userId).eq("projectId", undefined),
      )
      .take(50);
    for (const c of userLevelMediaCreds) {
      if (c.vaultSecretId) ids.add(c.vaultSecretId);
    }

    const projects = await ctx.db
      .query("projects")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .take(100);
    for (const project of projects) {
      for (const id of await listProjectVaultIds(ctx, project._id)) {
        ids.add(id);
      }
    }

    return [...ids];
  },
});

export const _wipeChunk = internalMutation({
  args: {
    userId: v.id("users"),
    batch: v.number(),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{
    remaining: number;
    projectsDeleted: number;
    documentsDeleted: number;
    mediaDeleted: number;
  }> => {
    let budget = args.batch;
    let projectsDeleted = 0;
    let documentsDeleted = 0;
    let mediaDeleted = 0;

    if (budget > 0) {
      const documents = await ctx.db
        .query("documents")
        .withIndex("by_userId", (q) => q.eq("userId", args.userId))
        .take(5000);
      for (const doc of documents) {
        if (budget <= 0) break;
        const rows = await ctx.db
          .query("scheduled_publishes")
          .withIndex("by_documentId", (q) => q.eq("documentId", doc._id))
          .take(budget);
        for (const row of rows) {
          await ctx.db.delete(row._id);
          budget--;
        }
      }
    }

    if (budget > 0) {
      const projects = await ctx.db
        .query("projects")
        .withIndex("by_userId", (q) => q.eq("userId", args.userId))
        .take(100);
      for (const project of projects) {
        if (budget <= 0) break;
        const rows = await ctx.db
          .query("publish_history")
          .withIndex("by_projectId", (q) => q.eq("projectId", project._id))
          .take(budget);
        for (const row of rows) {
          await ctx.db.delete(row._id);
          budget--;
        }
      }
    }

    if (budget > 0) {
      const rows = await ctx.db
        .query("publish_history_content")
        .withIndex("by_userId", (q) => q.eq("userId", args.userId))
        .take(budget);
      for (const row of rows) {
        await ctx.db.delete(row._id);
        budget--;
      }
    }

    if (budget > 0) {
      const rows = await ctx.db
        .query("media")
        .withIndex("by_userId", (q) => q.eq("userId", args.userId))
        .take(budget);
      for (const row of rows) {
        await ctx.db.delete(row._id);
        budget--;
        mediaDeleted++;
      }
    }

    if (budget > 0) {
      const rows = await ctx.db
        .query("mediaErrorLog")
        .withIndex("by_userId_and_createdAt", (q) =>
          q.eq("userId", args.userId),
        )
        .take(budget);
      for (const row of rows) {
        await ctx.db.delete(row._id);
        budget--;
      }
    }

    if (budget > 0) {
      const rows = await ctx.db
        .query("mediaUsage")
        .withIndex("by_userId", (q) => q.eq("userId", args.userId))
        .take(budget);
      for (const row of rows) {
        await ctx.db.delete(row._id);
        budget--;
      }
    }

    if (budget > 0) {
      const rows = await ctx.db
        .query("mediaCredentials")
        .withIndex("by_userId_and_provider", (q) => q.eq("userId", args.userId))
        .take(budget);
      for (const row of rows) {
        await ctx.db.delete(row._id);
        budget--;
      }
    }

    if (budget > 0) {
      const rows = await ctx.db
        .query("aiCredentials")
        .withIndex("by_userId_and_provider", (q) => q.eq("userId", args.userId))
        .take(budget);
      for (const row of rows) {
        await ctx.db.delete(row._id);
        budget--;
      }
    }

    if (budget > 0) {
      const projects = await ctx.db
        .query("projects")
        .withIndex("by_userId", (q) => q.eq("userId", args.userId))
        .take(50);
      for (const project of projects) {
        if (budget <= 0) break;
        const rows = await ctx.db
          .query("sync_conflicts")
          .withIndex("by_projectId", (q) => q.eq("projectId", project._id))
          .take(budget);
        for (const row of rows) {
          await ctx.db.delete(row._id);
          budget--;
        }
      }
    }

    if (budget > 0) {
      const batches = await ctx.db
        .query("import_batches")
        .withIndex("by_userId_and_createdAt", (q) =>
          q.eq("userId", args.userId),
        )
        .take(budget);
      for (const batch of batches) {
        if (budget <= 0) break;
        const outcomes = await ctx.db
          .query("import_job_outcomes")
          .withIndex("by_batchId", (q) => q.eq("batchId", batch._id))
          .take(budget);
        for (const outcome of outcomes) {
          await ctx.db.delete(outcome._id);
          budget--;
        }
        if (budget > 0) {
          const remaining = await ctx.db
            .query("import_job_outcomes")
            .withIndex("by_batchId", (q) => q.eq("batchId", batch._id))
            .take(1);
          if (remaining.length === 0) {
            await ctx.db.delete(batch._id);
            budget--;
          }
        }
      }
    }

    if (budget > 0) {
      const batches = await ctx.db
        .query("delete_batches")
        .withIndex("by_userId_and_createdAt", (q) =>
          q.eq("userId", args.userId),
        )
        .take(budget);
      for (const batch of batches) {
        if (budget <= 0) break;
        const outcomes = await ctx.db
          .query("delete_job_outcomes")
          .withIndex("by_batchId", (q) => q.eq("batchId", batch._id))
          .take(budget);
        for (const outcome of outcomes) {
          await ctx.db.delete(outcome._id);
          budget--;
        }
        if (budget > 0) {
          const remaining = await ctx.db
            .query("delete_job_outcomes")
            .withIndex("by_batchId", (q) => q.eq("batchId", batch._id))
            .take(1);
          if (remaining.length === 0) {
            await ctx.db.delete(batch._id);
            budget--;
          }
        }
      }
    }

    if (budget > 0) {
      const rows = await ctx.db
        .query("ai_stream_owners")
        .withIndex("by_userId_and_createdAt", (q) =>
          q.eq("userId", args.userId),
        )
        .take(budget);
      for (const row of rows) {
        await ctx.db.delete(row._id);
        budget--;
      }
    }

    if (budget > 0) {
      const rows = await ctx.db
        .query("project_stats")
        .withIndex("by_userId", (q) => q.eq("userId", args.userId))
        .take(budget);
      for (const row of rows) {
        await ctx.db.delete(row._id);
        budget--;
      }
    }

    if (budget > 0) {
      const rows = await ctx.db
        .query("writing_stats")
        .withIndex("by_userId", (q) => q.eq("userId", args.userId))
        .take(budget);
      for (const row of rows) {
        await ctx.db.delete(row._id);
        budget--;
      }
    }

    if (budget > 0) {
      const rows = await ctx.db
        .query("document_draft_content")
        .withIndex("by_userId", (q) => q.eq("userId", args.userId))
        .take(budget);
      for (const row of rows) {
        await ctx.db.delete(row._id);
        budget--;
      }
    }

    if (budget > 0) {
      const rows = await ctx.db
        .query("document_snapshot_content")
        .withIndex("by_userId", (q) => q.eq("userId", args.userId))
        .take(budget);
      for (const row of rows) {
        await ctx.db.delete(row._id);
        budget--;
      }
    }

    if (budget > 0) {
      const rows = await ctx.db
        .query("document_content")
        .withIndex("by_userId", (q) => q.eq("userId", args.userId))
        .take(budget);
      for (const row of rows) {
        await ctx.db.delete(row._id);
        budget--;
      }
    }

    if (budget > 0) {
      const rows = await ctx.db
        .query("document_links")
        .withIndex("by_userId", (q) => q.eq("userId", args.userId))
        .take(budget);
      for (const row of rows) {
        await ctx.db.delete(row._id);
        budget--;
      }
    }

    if (budget > 0) {
      const rows = await ctx.db
        .query("note_shares")
        .withIndex("by_userId_and_createdAt", (q) =>
          q.eq("userId", args.userId),
        )
        .take(budget);
      for (const row of rows) {
        await ctx.db.delete(row._id);
        budget--;
      }
    }

    if (budget > 0) {
      const notes = await ctx.db
        .query("notes")
        .withIndex("by_userId_and_trashedAt_and_updatedAt", (q) =>
          q.eq("userId", args.userId),
        )
        .take(Math.min(budget, NOTE_WIPE_BATCH));
      for (const note of notes) {
        if (budget <= 0) break;
        budget = await wipeNoteRows(ctx, note._id, budget);
      }
    }

    if (budget > 0) {
      const rows = await ctx.db
        .query("note_groups")
        .withIndex("by_userId_and_sortOrder", (q) =>
          q.eq("userId", args.userId),
        )
        .take(budget);
      for (const row of rows) {
        await ctx.db.delete(row._id);
        budget--;
      }
    }

    if (budget > 0) {
      const rows = await ctx.db
        .query("note_stats")
        .withIndex("by_userId", (q) => q.eq("userId", args.userId))
        .take(budget);
      for (const row of rows) {
        await ctx.db.delete(row._id);
        budget--;
      }
    }

    if (budget > 0) {
      const rows = await ctx.db
        .query("note_settings")
        .withIndex("by_userId", (q) => q.eq("userId", args.userId))
        .take(budget);
      for (const row of rows) {
        await ctx.db.delete(row._id);
        budget--;
      }
    }

    if (budget > 0) {
      const rows = await ctx.db
        .query("documents")
        .withIndex("by_userId", (q) => q.eq("userId", args.userId))
        .take(budget);
      for (const row of rows) {
        await ctx.db.delete(row._id);
        budget--;
        documentsDeleted++;
      }
    }

    if (budget > 0) {
      const projects = await ctx.db
        .query("projects")
        .withIndex("by_userId", (q) => q.eq("userId", args.userId))
        .take(100);
      for (const project of projects) {
        if (budget <= 0) break;
        const wiped = await wipeProjectRows(ctx, project._id, budget);
        budget = wiped.budget;
        documentsDeleted += wiped.documentsDeleted;
        mediaDeleted += wiped.mediaDeleted;
      }
    }

    if (budget > 0) {
      const rows = await ctx.db
        .query("projects")
        .withIndex("by_userId", (q) => q.eq("userId", args.userId))
        .take(budget);
      for (const row of rows) {
        await ctx.db.delete(row._id);
        budget--;
        projectsDeleted++;
      }
    }

    const remaining = await countRemaining(ctx, args.userId);

    return { remaining, projectsDeleted, documentsDeleted, mediaDeleted };
  },
});

async function countRemaining(
  ctx: MutationCtx,
  userId: Id<"users">,
): Promise<number> {
  const tables = await Promise.all([
    ctx.db
      .query("projects")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .take(1),
    ctx.db
      .query("documents")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .take(1),
    ctx.db
      .query("document_content")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .take(1),
    ctx.db
      .query("document_draft_content")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .take(1),
    ctx.db
      .query("document_snapshot_content")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .take(1),
    ctx.db
      .query("publish_history_content")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .take(1),
    ctx.db
      .query("document_links")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .take(1),
    ctx.db
      .query("media")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .take(1),
    ctx.db
      .query("mediaErrorLog")
      .withIndex("by_userId_and_createdAt", (q) => q.eq("userId", userId))
      .take(1),
    ctx.db
      .query("mediaUsage")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .take(1),
    ctx.db
      .query("mediaCredentials")
      .withIndex("by_userId_and_provider", (q) => q.eq("userId", userId))
      .take(1),
    ctx.db
      .query("aiCredentials")
      .withIndex("by_userId_and_provider", (q) => q.eq("userId", userId))
      .take(1),
    ctx.db
      .query("import_batches")
      .withIndex("by_userId_and_createdAt", (q) => q.eq("userId", userId))
      .take(1),
    ctx.db
      .query("delete_batches")
      .withIndex("by_userId_and_createdAt", (q) => q.eq("userId", userId))
      .take(1),
    ctx.db
      .query("ai_stream_owners")
      .withIndex("by_userId_and_createdAt", (q) => q.eq("userId", userId))
      .take(1),
    ctx.db
      .query("project_stats")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .take(1),
    ctx.db
      .query("writing_stats")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .take(1),
    ctx.db
      .query("notes")
      .withIndex("by_userId_and_trashedAt_and_updatedAt", (q) =>
        q.eq("userId", userId),
      )
      .take(1),
    ctx.db
      .query("note_groups")
      .withIndex("by_userId_and_sortOrder", (q) => q.eq("userId", userId))
      .take(1),
    ctx.db
      .query("note_shares")
      .withIndex("by_userId_and_createdAt", (q) => q.eq("userId", userId))
      .take(1),
    ctx.db
      .query("note_stats")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .take(1),
    ctx.db
      .query("note_settings")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .take(1),
  ]);

  let count = 0;
  for (const result of tables) {
    count += result.length;
  }

  if (count > 0) return count;

  const documents = await ctx.db
    .query("documents")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .take(50);
  for (const doc of documents) {
    const sps = await ctx.db
      .query("scheduled_publishes")
      .withIndex("by_documentId", (q) => q.eq("documentId", doc._id))
      .take(1);
    count += sps.length;
    if (count > 0) return count;
  }

  const projects = await ctx.db
    .query("projects")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .take(50);
  for (const project of projects) {
    const phs = await ctx.db
      .query("publish_history")
      .withIndex("by_projectId", (q) => q.eq("projectId", project._id))
      .take(1);
    count += phs.length;
    if (count > 0) return count;

    const conflicts = await ctx.db
      .query("sync_conflicts")
      .withIndex("by_projectId", (q) => q.eq("projectId", project._id))
      .take(1);
    count += conflicts.length;
    if (count > 0) return count;
  }

  return count;
}

export const _resetUserRow = internalMutation({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.userId, {
      githubVaultSecretId: undefined,
      githubUsername: undefined,
      defaultCompressionSettings: undefined,
    });
  },
});
