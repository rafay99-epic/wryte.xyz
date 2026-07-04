import { internal } from "../_generated/api";
import { action } from "../_generated/server";
import { requireAdmin } from "../_lib/admin";
import { getRateLimitKey, rateLimiter } from "../_lib/rateLimits";

/**
 * Admin migration: repair existing projects' frontmatter schemas.
 *
 * Existing projects were created with the old single-file detection, which
 * mistyped list fields (tags/keywords/categories/…) as scalar strings. That
 * stored schema both degrades the editor UX and is what broke typed-framework
 * builds (Astro `z.array`). This walks every project and flips those fields to
 * the array type via `_backfillFrontmatterSchemas` (paginated + self-continuing).
 *
 * Note: the publish-time guard already prevents broken deploys regardless of
 * this migration — this just makes the *stored* schema honest. It cannot set
 * `framework`/`frontmatterFormat` (those need a repo scan); use the per-project
 * "re-detect" flow for the full framework-aware refresh.
 *
 * Run from the Convex dashboard after deploying. Idempotent.
 */
export const backfillFrontmatterSchemas = action({
  args: {},
  handler: async (ctx): Promise<{ status: string; details: string }> => {
    const key = await getRateLimitKey(ctx);
    await rateLimiter.limit(ctx, "migrations:run", { key, throws: true });
    await requireAdmin(ctx);

    const result: { patched: number; scanned: number; isDone: boolean } =
      await ctx.runMutation(
        internal.cms.projects._backfillFrontmatterSchemas,
        {},
      );

    return {
      status: "ok",
      details: `Scanned ${String(result.scanned)} projects, repaired ${String(result.patched)}. ${
        result.isDone
          ? "Complete."
          : "Continuation scheduled for remaining projects."
      }`,
    };
  },
});
