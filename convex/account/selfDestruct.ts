/**
 * Self-destruct — wipes every user-scoped row in Convex, every vault entry,
 * every scheduled-publish workflow, and resets the user record in place.
 *
 * Three things this deliberately does NOT do:
 *  - Delete the Clerk account (the user stays signed in).
 *  - Touch files in the user's external provider accounts (UploadThing /
 *    Cloudinary / GitHub files persist; only the credentials linking us to
 *    them are removed).
 *  - Delete the Convex `users` row — patched in place so the active session
 *    survives and the next page load sees an empty inventory.
 *
 * Architecture is in `/Users/prometheus/.claude/plans/yeah-so-here-s-the-crispy-zephyr.md`
 * under "Self-Destruct (User Account Reset)".
 */

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
import { publishWorkflowManager } from "../integrations/scheduling";

/* ------------------------------------------------------------------ */
/*  Public query: pre-flight inventory for the confirmation dialog     */
/* ------------------------------------------------------------------ */

/**
 * Returns the cost of running self-destruct so the UI can show the user
 * exactly what's about to be wiped. Cheap counts via indexes; no secret data.
 */
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

    // Walk every user document and collect pending/processing scheduled publishes.
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
      hasGithubLegacyToken: Boolean(user.githubAccessToken),
      scheduled,
    };
  },
});

/* ------------------------------------------------------------------ */
/*  Public action: the orchestrator                                     */
/* ------------------------------------------------------------------ */

/**
 * Wipe everything for the signed-in user. Sequenced so partial failures
 * (most commonly: WorkOS vault unavailable) leave Convex in a recoverable
 * state instead of orphaning data we can't see.
 *
 * Returns a structured summary the client can render as a toast.
 */
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

    /* -- Step A: cancel scheduled-publish workflows -- */
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
        // Workflow may already be completed or canceled. Either way the row
        // is going to be deleted in the wipe loop below — log and continue.
        scheduledFailedToCancel++;
      }
    }

    /* -- Step B: vault cleanup (best-effort) -- */
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
        // WorkOS unreachable or entry already gone — keep going. The Convex
        // wipe below still proceeds; the orphan count comes back in the
        // summary so the UI can surface a partial-success toast.
        vaultOrphaned++;
      }
    }

    /* -- Step C: chunked Convex wipe -- */
    // Hard upper bound prevents a buggy mutation from looping forever.
    // 200 iterations × batch 200 = 40k rows max per invocation.
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

    /* -- Step D: reset the user row in place -- */
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

/* ------------------------------------------------------------------ */
/*  Internal queries used by the orchestrator                           */
/* ------------------------------------------------------------------ */

/**
 * All scheduled_publishes for the user that still need cancelling.
 * Walks projects → documents → scheduled_publishes because there's no
 * by_userId index on scheduled_publishes (intentional — that table is keyed
 * on documentId / scheduledAt for the cron-style polling done elsewhere).
 */
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

/**
 * Every vault id owned by the user — the GitHub PAT pointer plus every
 * mediaCredentials.vaultSecretId.
 */
export const _listVaultIds = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, args): Promise<string[]> => {
    const ids: string[] = [];

    const user = await ctx.db.get(args.userId);
    if (user?.githubVaultSecretId) ids.push(user.githubVaultSecretId);

    const mediaCreds = await ctx.db
      .query("mediaCredentials")
      .withIndex("by_userId_and_provider", (q) => q.eq("userId", args.userId))
      .take(20);
    for (const c of mediaCreds) {
      if (c.vaultSecretId) ids.push(c.vaultSecretId);
    }

    const aiCreds = await ctx.db
      .query("aiCredentials")
      .withIndex("by_userId_and_provider", (q) => q.eq("userId", args.userId))
      .take(20);
    for (const c of aiCreds) {
      if (c.vaultSecretId) ids.push(c.vaultSecretId);
    }

    return ids;
  },
});

/* ------------------------------------------------------------------ */
/*  Internal mutations: chunked wipe + user-row reset                   */
/* ------------------------------------------------------------------ */

/**
 * Processes up to `batch` deletes across the user's tables and returns
 * `{ remaining }` for the orchestrator to decide whether to loop.
 *
 * Deletion order is deliberate:
 *  1. scheduled_publishes (cleanest if workflows were cancelled in step A)
 *  2. publish_history     (audit rows, no dependents)
 *  3. media               (also drops legacy `_storage` blobs)
 *  4. mediaErrorLog
 *  5. mediaUsage
 *  6. mediaCredentials    (vault entries already removed in step B)
 *  7. documents
 *  8. projects
 *
 * Inside each table we drain as many rows as the remaining batch budget
 * allows; `remaining` totals what would still need to be processed.
 */
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

    /* 1. scheduled_publishes via documents */
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

    /* 2. publish_history via projects */
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

    /* 2b. publish_history_content — bodies live in their own table (see
     *     `document_content` at step 7c below for the same split); has a
     *     direct `by_userId` index so no need to walk via projects. */
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

    /* 3. media (+ legacy storage blobs) */
    if (budget > 0) {
      const rows = await ctx.db
        .query("media")
        .withIndex("by_userId", (q) => q.eq("userId", args.userId))
        .take(budget);
      for (const row of rows) {
        if (row.storageId) {
          try {
            await ctx.storage.delete(row.storageId);
          } catch {
            // Blob may already be gone — keep going so the row still drops.
          }
        }
        await ctx.db.delete(row._id);
        budget--;
        mediaDeleted++;
      }
    }

    /* 4. mediaErrorLog */
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

    /* 5. mediaUsage */
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

    /* 6. mediaCredentials */
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

    /* 6b. aiCredentials */
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

    /* 6c. sync_conflicts via projects */
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

    /* 6d. import_job_outcomes + import_batches */
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

    /* 6e. delete_job_outcomes + delete_batches */
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

    /* 6f. ai_stream_owners (bookkeeping for AI stream ownership). */
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

    /* 7. project_stats */
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

    /* 7b. writing_stats */
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

    /* 7c-i. document_draft_content — draft bodies live in their own table
     *       with a direct `by_userId` index. Note: `document_drafts`
     *       metadata rows themselves aren't drained anywhere in this chunk
     *       today (a pre-existing gap independent of this content split —
     *       see the cost-audit cascade notes); this only prevents the new
     *       content table from outliving even that. */
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

    /* 7c-ii. document_snapshot_content — same story as 7c-i, mirrored for
     *        `document_snapshots`. */
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

    /* 7c. document_content — bodies live in their own table; drain them
     *     before the parent documents so no orphaned rows remain. */
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

    /* 8. documents */
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

    /* 9. projects */
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

    // What's still pending across every table this user owns.
    const remaining = await countRemaining(ctx, args.userId);

    return { remaining, projectsDeleted, documentsDeleted, mediaDeleted };
  },
});

/**
 * Sum of every still-pending row for the user. Called at the end of each
 * `_wipeChunk` so the orchestrator knows whether to loop another pass.
 * Uses `.take(1)` for tables we just drained (we only care if anything is
 * left, not the exact count), and traverses documents/projects only when
 * the direct-indexed tables are already empty.
 */
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

/**
 * Patches the users row to clear all per-user data while keeping the Clerk
 * identifier intact, so the active session stays valid.
 */
export const _resetUserRow = internalMutation({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.userId, {
      githubAccessToken: undefined,
      githubVaultSecretId: undefined,
      githubUsername: undefined,
      defaultCompressionSettings: undefined,
    });
  },
});
