/**
 * ONE-SHOT MIGRATION — delete this file after running.
 *
 * Backfills the `animation_names` table from existing `animations` rows.
 * Run once after deploying the `animation_names` schema change so every
 * existing animation has a lightweight name row. New mutations sync
 * automatically.
 *
 * Triggered from the admin UI (`/admin/seed`) or:
 *
 *   bunx convex run _seed/animationNames:seed
 *
 * Idempotent: re-runs skip already-present names (project + name pair).
 */
import { internal } from "../_generated/api";
import { action, internalMutation } from "../_generated/server";
import { requireAdmin } from "../_lib/admin";
import { getRateLimitKey, rateLimiter } from "../_lib/rateLimits";

export const seed = action({
  args: {},
  handler: async (
    ctx,
  ): Promise<{ inserted: number; skipped: number; details: string[] }> => {
    const key = await getRateLimitKey(ctx);
    await rateLimiter.limit(ctx, "seed:run", { key, throws: true });

    await requireAdmin(ctx);
    return await ctx.runMutation(
      internal._seed.animationNames._seedInternal,
      {},
    );
  },
});

export const _seedInternal = internalMutation({
  args: {},
  handler: async (ctx) => {
    // Scan all animation rows (bounded — 200 per project via MAX_ANIMATIONS)
    const projectRows = await ctx.db.query("projects").collect();
    let inserted = 0;
    let skipped = 0;
    const details: string[] = [];

    for (const project of projectRows) {
      const animations = await ctx.db
        .query("animations")
        .withIndex("by_project", (q) => q.eq("projectId", project._id))
        .collect();

      for (const anim of animations) {
        const existing = await ctx.db
          .query("animation_names")
          .withIndex("by_project_and_name", (q) =>
            q.eq("projectId", project._id).eq("name", anim.name),
          )
          .unique();

        if (existing) {
          skipped += 1;
        } else {
          await ctx.db.insert("animation_names", {
            projectId: project._id,
            name: anim.name,
          });
          inserted += 1;
        }
      }
    }

    details.push(`${inserted} animation name rows inserted`);
    if (skipped > 0) details.push(`${skipped} already present (skipped)`);

    return { inserted, skipped, details };
  },
});
