import { v } from "convex/values";
import { internalMutation, mutation, query } from "../_generated/server";

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

/**
 * Public deploy-time stamp. The deploy script (`scripts/stamp-version.ts`)
 * authenticates by supplying `VERSION_STAMP_SECRET`, which must be set as
 * a Convex env var. Without the secret an anonymous caller could overwrite
 * the singleton row and trigger "new version available" toasts on every
 * connected client (see `useVersionCheck`).
 */
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

/** Internal twin for use from other Convex functions (no secret needed). */
export const _stamp = internalMutation({
  args: {
    version: v.string(),
    build: v.string(),
  },
  handler: async (ctx, args) => {
    await writeStamp(ctx, args);
  },
});
