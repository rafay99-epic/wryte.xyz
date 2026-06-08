import { internal } from "../_generated/api";
import { action } from "../_generated/server";
import { requireAdmin } from "../_lib/admin";
import { getRateLimitKey, rateLimiter } from "../_lib/rateLimits";

/**
 * Admin migration: upgrade existing projects' stored `aiModel` to a current,
 * valid id for their provider.
 *
 * Before the provider-registry refactor the model dropdown offered stale ids
 * (e.g. `claude-sonnet-4-20250514`, retired 2026-06-15) and a couple of
 * invented ones. Projects saved with those would fail at generation time. This
 * rewrites them onto the registry's current ids while preserving the chosen
 * tier (Opus→Opus, Sonnet→Sonnet, Haiku→Haiku; removed free OpenRouter slugs →
 * the current free default). See `_backfillAiModels` in `cms/projects.ts`.
 *
 * Idempotent + paginated/self-continuing — safe to re-run; only projects whose
 * model actually changes are touched.
 */
export const backfillAiModels = action({
  args: {},
  handler: async (ctx): Promise<{ status: string; details: string }> => {
    const key = await getRateLimitKey(ctx);
    await rateLimiter.limit(ctx, "seed:run", { key, throws: true });
    await requireAdmin(ctx);

    const result: { patched: number; scanned: number; isDone: boolean } =
      await ctx.runMutation(internal.cms.projects._backfillAiModels, {});

    return {
      status: "ok",
      details: `Scanned ${String(result.scanned)} projects, updated ${String(result.patched)}. ${
        result.isDone
          ? "Complete."
          : "Continuation scheduled for remaining projects."
      }`,
    };
  },
});
