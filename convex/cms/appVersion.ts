import { v } from "convex/values";
import { mutation, query } from "../_generated/server";

export const current = query({
  args: {},
  handler: async (ctx) => {
    const row = await ctx.db.query("app_version").first();
    return row ?? null;
  },
});

export const stamp = mutation({
  args: {
    version: v.string(),
    build: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db.query("app_version").first();
    const now = Date.now();

    if (existing) {
      await ctx.db.patch(existing._id, {
        version: args.version,
        build: args.build,
        deployedAt: now,
      });
    } else {
      await ctx.db.insert("app_version", {
        version: args.version,
        build: args.build,
        deployedAt: now,
      });
    }
  },
});
