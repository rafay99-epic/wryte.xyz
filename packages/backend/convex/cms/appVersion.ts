import { v } from "convex/values";
import { mutation, query } from "../_generated/server";

export const current = query({
  args: {},
  handler: async (ctx) => {
    const row = await ctx.db.query("app_version").first();
    return row ?? null;
  },
});

const writeStamp = async (
  ctx: { db: import("../_generated/server").MutationCtx["db"] },
  args: { version: string; build: string },
) => {
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
};

export const stamp = mutation({
  args: {
    version: v.string(),
    build: v.string(),
    secret: v.string(),
  },
  handler: async (ctx, args) => {
    const expected = process.env["VERSION_STAMP_SECRET"];
    if (!expected) {
      throw new Error("VERSION_STAMP_SECRET is not configured");
    }
    if (args.secret !== expected) {
      throw new Error("Invalid stamp secret");
    }
    await writeStamp(ctx, { version: args.version, build: args.build });
  },
});
