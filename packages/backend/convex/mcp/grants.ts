/**
 * Reading and writing the per-user MCP capability grant.
 *
 * See `./scopes.ts` for why the grant lives here rather than in the OAuth
 * token: Clerk has no custom scopes, so the token carries identity and this
 * carries capability.
 */
import { v } from "convex/values";
import { internalQuery, mutation, query } from "../_generated/server";
import { getAuthedUserOrNull, getCurrentUser } from "../_lib/auth";
import { getRateLimitKey, rateLimiter } from "../_lib/rateLimits";
import { ALL_SCOPES, DEFAULT_GRANT, type Scope } from "./scopes";

/**
 * Looks up a grant by Clerk subject — the `sub` claim of the MCP client's
 * access token, which is also what `users.clerkUserId` stores.
 *
 * Internal because it's called from the `/mcp` `httpAction`, not by any
 * client. Returns `null` for an unknown subject so the caller can distinguish
 * "no such user" from "user with an empty grant".
 */
export const _forSubject = internalQuery({
  args: { subject: v.string() },
  returns: v.union(v.null(), v.array(v.string())),
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkUserId", (q) => q.eq("clerkUserId", args.subject))
      .unique();
    if (!user) return null;
    return user.mcpScopes ?? [...DEFAULT_GRANT];
  },
});

/**
 * The caller's own grant, for the settings UI. Read-only, so it uses
 * `getAuthedUserOrNull` rather than `getCurrentUser` (which needs a writer ctx
 * for its `clerkUserId` backfill) and falls back to the default rather than
 * throwing — a settings panel should render toggles, not an error boundary.
 */
export const myGrant = query({
  args: {},
  returns: v.array(v.string()),
  handler: async (ctx) => {
    const user = await getAuthedUserOrNull(ctx);
    return user?.mcpScopes ?? [...DEFAULT_GRANT];
  },
});

/**
 * Replaces the caller's grant. Unknown capability strings are rejected rather
 * than stored — an unrecognised entry would sit in the array looking granted
 * while matching no tool, which is the kind of thing that reads as a bug in
 * the authorizer six months later.
 */
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

    // Deduplicate and store in a stable order so the row doesn't churn on
    // re-saves that only reordered the checkboxes.
    const next = ALL_SCOPES.filter((scope: Scope) =>
      args.scopes.includes(scope),
    );
    await ctx.db.patch(user._id, { mcpScopes: [...next] });
    return null;
  },
});
