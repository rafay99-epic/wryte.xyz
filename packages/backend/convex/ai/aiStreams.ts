/**
 * Maintenance for the `ai_stream_owners` bookkeeping table.
 *
 * Each AI stream inserts one ownership row (see `enhance.ts:trackStreamOwner`)
 * that gates `getStreamBody` reads. A stream is generated and read within
 * seconds; the row is dead weight minutes later. Without a sweep these rows
 * only disappear on project/user deletion, so at scale (50K concurrent users)
 * the table grows by millions of rows/hour.
 *
 * Budget-aware design (this project runs the persistent-text-streaming
 * component's own GC cron at 24h, not 1m, to conserve Convex function calls —
 * see patches/):
 *   - The cron fires once per day, not hourly — minimal trigger overhead.
 *   - Each run deletes a bounded batch, then re-schedules itself only while a
 *     full batch came back. So the number of mutation calls scales with the
 *     actual backlog (unavoidable work), never with wall-clock — and the day's
 *     backlog is always fully drained regardless of volume. A fixed per-run cap
 *     with no continuation would silently fall behind at scale.
 */

import { internal } from "../_generated/api";
import { internalMutation } from "../_generated/server";

/**
 * Rows older than this are safe to delete — the stream finished and was read
 * long ago (generation completes in seconds; the component GCs the blob itself
 * within 24h). Kept short so the table stays lean between daily sweeps.
 */
const OWNER_TTL_MS = 2 * 60 * 60 * 1000;

/**
 * Rows deleted per mutation. One transaction reads + deletes this many docs
 * (≈2× ops), comfortably within Convex's per-mutation limits. When a run
 * deletes exactly this many, more likely remain and it re-schedules itself.
 */
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

    // Backlog likely exceeds one batch — keep draining in fresh transactions
    // rather than one oversized (limit-blowing) mutation. Stops as soon as a
    // run comes back short, so it can't loop on a drained table.
    if (stale.length === CLEANUP_BATCH) {
      await ctx.scheduler.runAfter(0, internal.ai.aiStreams._cleanupOwners, {});
    }

    return { deleted: stale.length };
  },
});
