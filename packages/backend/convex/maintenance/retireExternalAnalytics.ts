/**
 * Admin-only cleanup for the retired Plausible/Umami integration.
 *
 * The feature code is gone, but Convex data and vault objects need an explicit
 * cleanup before the compatibility tables can be removed from the schema.
 * This migration is idempotent and drains both tables in bounded batches.
 */

import { v } from "convex/values";
import { internal } from "../_generated/api";
import { action, internalMutation } from "../_generated/server";
import { requireAdmin } from "../_lib/admin";
import { getRateLimitKey, rateLimiter } from "../_lib/rateLimits";

const BATCH_SIZE = 100;

const migrationResult = v.object({
  deletedTargets: v.number(),
  deletedSnapshots: v.number(),
  secretsQueued: v.number(),
  remaining: v.boolean(),
});

type MigrationResult = {
  deletedTargets: number;
  deletedSnapshots: number;
  secretsQueued: number;
  remaining: boolean;
};

export const run = action({
  args: {},
  returns: migrationResult,
  handler: async (ctx): Promise<MigrationResult> => {
    const key = await getRateLimitKey(ctx);
    await rateLimiter.limit(ctx, "maintenance:retireExternalAnalytics", {
      key,
      throws: true,
    });
    await requireAdmin(ctx);
    return await ctx.runMutation(
      internal.maintenance.retireExternalAnalytics._runBatch,
      {},
    );
  },
});

export const _runBatch = internalMutation({
  args: {},
  returns: migrationResult,
  handler: async (ctx): Promise<MigrationResult> => {
    const targets = await ctx.db
      .query("analytics_targets")
      .withIndex("by_projectId")
      .take(BATCH_SIZE);
    const snapshots = await ctx.db
      .query("analytics_snapshots")
      .withIndex("by_projectId")
      .take(BATCH_SIZE);

    let secretsQueued = 0;
    for (const target of targets) {
      if (target.vaultSecretId) {
        await ctx.scheduler.runAfter(
          0,
          internal.integrations.secretStore._delete,
          {
            id: target.vaultSecretId,
          },
        );
        secretsQueued += 1;
      }
      await ctx.db.delete(target._id);
    }

    for (const snapshot of snapshots) {
      await ctx.db.delete(snapshot._id);
    }

    const remaining =
      targets.length === BATCH_SIZE || snapshots.length === BATCH_SIZE;
    if (remaining) {
      await ctx.scheduler.runAfter(
        0,
        internal.maintenance.retireExternalAnalytics._runBatch,
        {},
      );
    }

    return {
      deletedTargets: targets.length,
      deletedSnapshots: snapshots.length,
      secretsQueued,
      remaining,
    };
  },
});
