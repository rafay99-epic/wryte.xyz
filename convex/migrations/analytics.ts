import { internal } from "../_generated/api";
import { action } from "../_generated/server";
import { requireAdmin } from "../_lib/admin";
import { getRateLimitKey, rateLimiter } from "../_lib/rateLimits";

export const backfillWordCounts = action({
  args: {},
  handler: async (ctx): Promise<{ status: string; details: string }> => {
    const key = await getRateLimitKey(ctx);
    await rateLimiter.limit(ctx, "migrations:run", { key, throws: true });
    await requireAdmin(ctx);

    const result: { patched: number; scanned: number; isDone: boolean } =
      await ctx.runMutation(
        internal.analytics.writingStats._backfillWordCounts,
        {},
      );

    return {
      status: "ok",
      details: `Scanned ${String(result.scanned)} docs, patched ${String(result.patched)}. ${result.isDone ? "Complete." : "Continuation scheduled."}`,
    };
  },
});

export const backfillProjectStats = action({
  args: {},
  handler: async (ctx): Promise<{ status: string; details: string }> => {
    const key = await getRateLimitKey(ctx);
    await rateLimiter.limit(ctx, "migrations:run", { key, throws: true });
    await requireAdmin(ctx);

    const result: { projects: number; created: number; updated: number } =
      await ctx.runMutation(
        internal.analytics.writingStats._backfillProjectStats,
        {},
      );

    return {
      status: "ok",
      details: `${String(result.projects)} projects scanned — ${String(result.created)} created, ${String(result.updated)} updated.`,
    };
  },
});

export const backfillWritingStats = action({
  args: {},
  handler: async (ctx): Promise<{ status: string; details: string }> => {
    const key = await getRateLimitKey(ctx);
    await rateLimiter.limit(ctx, "migrations:run", { key, throws: true });
    await requireAdmin(ctx);

    const result: { users: number; created: number; updated: number } =
      await ctx.runMutation(
        internal.analytics.writingStats._backfillWritingStats,
        {},
      );

    return {
      status: "ok",
      details: `${String(result.users)} users scanned — ${String(result.created)} created, ${String(result.updated)} updated.`,
    };
  },
});

export const runFullMigration = action({
  args: {},
  handler: async (
    ctx,
  ): Promise<{
    status: string;
    steps: Array<{ name: string; details: string }>;
  }> => {
    const key = await getRateLimitKey(ctx);
    await rateLimiter.limit(ctx, "migrations:run", { key, throws: true });
    await requireAdmin(ctx);

    const steps: Array<{ name: string; details: string }> = [];

    const wc: { patched: number; scanned: number; isDone: boolean } =
      await ctx.runMutation(
        internal.analytics.writingStats._backfillWordCounts,
        {},
      );
    steps.push({
      name: "Word counts",
      details: `${String(wc.scanned)} docs scanned, ${String(wc.patched)} patched. ${wc.isDone ? "Complete." : "Continuation scheduled."}`,
    });

    const ps: { projects: number; created: number; updated: number } =
      await ctx.runMutation(
        internal.analytics.writingStats._backfillProjectStats,
        {},
      );
    steps.push({
      name: "Project stats",
      details: `${String(ps.projects)} projects — ${String(ps.created)} created, ${String(ps.updated)} updated.`,
    });

    const ws: { users: number; created: number; updated: number } =
      await ctx.runMutation(
        internal.analytics.writingStats._backfillWritingStats,
        {},
      );
    steps.push({
      name: "Writing stats",
      details: `${String(ws.users)} users — ${String(ws.created)} created, ${String(ws.updated)} updated.`,
    });

    return { status: "ok", steps };
  },
});
