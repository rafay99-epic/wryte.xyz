import { v } from "convex/values";
import { internalQuery, mutation, query } from "../_generated/server";
import { getAuthedUserOrNull, getCurrentUser } from "../_lib/auth";
import { getRateLimitKey, rateLimiter } from "../_lib/rateLimits";
import { ALL_SCOPES, currentScopes } from "./scopes";

export const _forSubject = internalQuery({
  args: { subject: v.string() },
  returns: v.union(v.null(), v.array(v.string())),
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkUserId", (q) => q.eq("clerkUserId", args.subject))
      .unique();
    if (!user) return null;
    return currentScopes(user.mcpScopes);
  },
});

export const myGrant = query({
  args: {},
  returns: v.array(v.string()),
  handler: async (ctx) => {
    const user = await getAuthedUserOrNull(ctx);
    return currentScopes(user?.mcpScopes);
  },
});

export const setGrant = mutation({
  args: { scopes: v.array(v.string()) },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    const key = await getRateLimitKey(ctx);
    await rateLimiter.limit(ctx, "mcp:setGrant", { key, throws: true });

    const allowed = new Set<string>(ALL_SCOPES);
    const unknown = args.scopes.filter((scope) => !allowed.has(scope));
    if (unknown.length > 0) {
      throw new Error(`Unknown MCP capability: ${unknown.join(", ")}`);
    }

    const next = ALL_SCOPES.filter((scope) => args.scopes.includes(scope));
    await ctx.db.patch(user._id, { mcpScopes: next });
    return null;
  },
});
