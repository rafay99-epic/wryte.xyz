/**
 * Cached 30-day analytics snapshot per project.
 *
 * `getSnapshot` is the reactive read the dashboard subscribes to; a fresh
 * row costs zero external calls. `refresh` is scheduled from the client
 * when the snapshot is stale — TTL-gated and rate-limited so a project
 * makes a handful of provider calls per hour against a 600/hr ceiling.
 */

import { ConvexError, v } from "convex/values";
import { internal } from "../_generated/api";
import {
  action,
  internalMutation,
  internalQuery,
  query,
} from "../_generated/server";
import { getAuthedUserOrNull } from "../_lib/auth";
import { getRateLimitKey, rateLimiter } from "../_lib/rateLimits";
import { fetchPlausibleStats } from "./plausible";
import { loadOwnerContext } from "./targets";
import { fetchUmamiStats } from "./umami";

/** Don't hit the provider more often than this per project. */
const SNAPSHOT_TTL_MS = 15 * 60 * 1000;

export const getSnapshot = query({
  args: { projectId: v.id("projects") },
  returns: v.union(
    v.null(),
    v.object({
      fetchedAt: v.number(),
      range: v.string(),
      totalsJson: v.string(),
      pagesJson: v.string(),
    }),
  ),
  handler: async (ctx, args) => {
    const user = await getAuthedUserOrNull(ctx);
    if (!user) return null;
    const project = await ctx.db.get(args.projectId);
    if (!project || project.userId !== user._id) return null;

    // Disabled analytics = invisible everywhere (sidebar, views column).
    // Share mode has no API data — nothing to serve either.
    const target = await ctx.db
      .query("analytics_targets")
      .withIndex("by_projectId", (q) => q.eq("projectId", args.projectId))
      .unique();
    if (!target || target.enabled !== true) return null;
    if ((target.mode ?? "api") !== "api") return null;

    const row = await ctx.db
      .query("analytics_snapshots")
      .withIndex("by_projectId", (q) => q.eq("projectId", args.projectId))
      .unique();
    if (!row) return null;
    return {
      fetchedAt: row.fetchedAt,
      range: row.range,
      totalsJson: row.totalsJson,
      pagesJson: row.pagesJson,
    };
  },
});

/**
 * Fetch fresh numbers from the provider unless the snapshot is younger
 * than the TTL. Safe to call optimistically from the dashboard.
 */
export const refresh = action({
  args: { projectId: v.id("projects") },
  returns: v.object({
    ok: v.boolean(),
    refreshed: v.boolean(),
    message: v.optional(v.string()),
  }),
  handler: async (
    ctx,
    args,
  ): Promise<{ ok: boolean; refreshed: boolean; message?: string }> => {
    const key = await getRateLimitKey(ctx);
    await rateLimiter.limit(ctx, "analytics:refresh", { key, throws: true });

    await loadOwnerContext(ctx, args.projectId);

    const target = await ctx.runQuery(internal.insights.targets._getByProject, {
      projectId: args.projectId,
    });
    if (!target) {
      throw new ConvexError({ message: "No analytics provider connected." });
    }
    if (target.enabled !== true) {
      throw new ConvexError({
        message: "Analytics is disabled — enable it in Settings → Analytics.",
      });
    }
    if ((target.mode ?? "api") !== "api" || !target.vaultSecretId) {
      throw new ConvexError({
        message:
          "Share-link mode embeds the provider's dashboard — there is no API data to refresh.",
      });
    }

    const existing = await ctx.runQuery(
      internal.insights.snapshots._getByProject,
      { projectId: args.projectId },
    );
    if (existing && Date.now() - existing.fetchedAt < SNAPSHOT_TTL_MS) {
      return { ok: true, refreshed: false };
    }

    await rateLimiter.limit(ctx, "vault:read", { key, throws: true });
    const token: string = await ctx.runAction(
      internal.integrations.secretStore._read,
      { id: target.vaultSecretId },
    );

    const shared = { token, baseUrl: target.baseUrl };
    const result =
      target.provider === "plausible"
        ? await fetchPlausibleStats({ ...shared, siteId: target.siteId })
        : await fetchUmamiStats({ ...shared, websiteId: target.siteId });

    if (!result.ok) {
      await ctx.runMutation(internal.insights.targets._setStatus, {
        targetId: target._id,
        status: "invalid",
        lastError: result.message,
      });
      return { ok: false, refreshed: false, message: result.message };
    }

    if (target.status === "invalid") {
      await ctx.runMutation(internal.insights.targets._setStatus, {
        targetId: target._id,
        status: "active",
      });
    }
    await ctx.runMutation(internal.insights.snapshots._upsert, {
      projectId: args.projectId,
      range: "30d",
      totalsJson: JSON.stringify(result.data.totals),
      pagesJson: JSON.stringify(result.data.pages),
    });
    return { ok: true, refreshed: true };
  },
});

/* ------------------------------------------------------------------ */
/*  Internal                                                            */
/* ------------------------------------------------------------------ */

export const _getByProject = internalQuery({
  args: { projectId: v.id("projects") },
  returns: v.union(
    v.null(),
    v.object({
      _id: v.id("analytics_snapshots"),
      fetchedAt: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("analytics_snapshots")
      .withIndex("by_projectId", (q) => q.eq("projectId", args.projectId))
      .unique();
    return row ? { _id: row._id, fetchedAt: row.fetchedAt } : null;
  },
});

export const _upsert = internalMutation({
  args: {
    projectId: v.id("projects"),
    range: v.string(),
    totalsJson: v.string(),
    pagesJson: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("analytics_snapshots")
      .withIndex("by_projectId", (q) => q.eq("projectId", args.projectId))
      .unique();
    const fields = {
      range: args.range,
      fetchedAt: Date.now(),
      totalsJson: args.totalsJson,
      pagesJson: args.pagesJson,
    };
    if (existing) {
      await ctx.db.patch(existing._id, fields);
    } else {
      await ctx.db.insert("analytics_snapshots", {
        projectId: args.projectId,
        ...fields,
      });
    }
    return null;
  },
});
