import { internal } from "../_generated/api";
import { internalMutation } from "../_generated/server";

const OWNER_TTL_MS = 2 * 60 * 60 * 1000;

const CLEANUP_BATCH = 1000;

export const _cleanupOwners = internalMutation({
  args: {},
  handler: async (ctx) => {
    const cutoff = Date.now() - OWNER_TTL_MS;

    const stale = await ctx.db
      .query("ai_stream_owners")
      .withIndex("by_createdAt", (q) => q.lt("createdAt", cutoff))
      .take(CLEANUP_BATCH);

    for (const row of stale) {
      await ctx.db.delete(row._id);
    }

    if (stale.length === CLEANUP_BATCH) {
      await ctx.scheduler.runAfter(0, internal.ai.aiStreams._cleanupOwners, {});
    }

    return { deleted: stale.length };
  },
});
