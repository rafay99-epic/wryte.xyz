import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import type { ActionCtx, MutationCtx, QueryCtx } from "../_generated/server";

/** Minimal Convex mutation context slice needed for user lookup. */
export type AuthDbCtx = Pick<MutationCtx, "auth" | "db">;

/** Read-only context slice used by query handlers — accepts QueryCtx
 *  and MutationCtx since DatabaseWriter extends DatabaseReader. */
export type AuthQueryCtx = Pick<QueryCtx, "auth" | "db">;

/**
 * Convex stores `tokenIdentifier` as `<issuer-url>|<clerk-user-id>`. Issuers
 * are URLs, so `|` only appears as the delimiter. Returns null if the
 * trailing segment doesn't look like a Clerk user id.
 *
 * Exported so `convex/account/users.ts` (and any future caller) can stay
 * in sync with the parsing convention without duplicating the logic.
 */
export function parseClerkUserId(tokenIdentifier: string): string | null {
  const parts = tokenIdentifier.split("|");
  const last = parts[parts.length - 1] ?? "";
  return last.startsWith("user_") ? last : null;
}

/**
 * Resolves the `users` row for an MCP caller injected by the gateway, throwing
 * if there isn't one.
 *
 * ## Why this exists, and why it must only be reachable from internal functions
 *
 * Convex does not propagate `ctx.auth` into component code, and the MCP gateway
 * dispatches tools from inside its component — so a tool handler sees
 * `ctx.auth.getUserIdentity() === null` no matter how valid the caller's token
 * was. The gateway's answer is `identityArg`: it resolves the caller host-side
 * (where the JWT *is* validated), strips any client-supplied value for that
 * argument, and injects the verified `{ subject, claims }` before dispatch.
 *
 * So `caller.subject` is trustworthy **only because of where it comes from**.
 * Every function that accepts one must be an `internalQuery` /
 * `internalMutation` / `internalAction`. A `caller` argument on a *public*
 * function would be a total impersonation hole: any unauthenticated client
 * could pass `{ subject: "user_someoneElse" }` and act as them. Nothing in the
 * callee can distinguish a component dispatch from a browser call, so internal
 * visibility is the enforcement mechanism.
 *
 * Throws (rather than returning null) because every one of the ~21 MCP handlers
 * wants the same outcome, and the message is the actionable one: this happens
 * when someone authorizes an agent before ever signing in on the web, since the
 * `users` row is created by the web app's `users.getOrCreate`.
 */
export const NO_MCP_ACCOUNT =
  "No Wryte account for this identity. Sign in at wryte.xyz once, then reconnect.";

export async function requireCaller(
  ctx: AuthQueryCtx,
  caller: { subject: string },
): Promise<Doc<"users">> {
  const user = await ctx.db
    .query("users")
    .withIndex("by_clerkUserId", (q) => q.eq("clerkUserId", caller.subject))
    .unique();
  if (!user) throw new Error(NO_MCP_ACCOUNT);
  return user;
}

/**
 * Action-context twin of {@link requireCaller}. Actions have no `ctx.db`, so the
 * lookup goes through an internal query.
 */
export async function requireCallerInAction(
  ctx: ActionCtx,
  caller: { subject: string },
): Promise<Doc<"users">> {
  const user = await ctx.runQuery(internal.account.users.internalGetByClerkId, {
    clerkUserId: caller.subject,
  });
  if (!user) throw new Error(NO_MCP_ACCOUNT);
  return user;
}

/**
 * Resolves a `users` row from a Convex `tokenIdentifier` (`<iss>|<sub>`).
 *
 * Two lookups, in order:
 *
 *   1. `by_tokenIdentifier` — the exact match. Every web-app request takes
 *      this path, so the common case is one indexed read.
 *   2. `by_clerkUserId` — fallback keyed on the Clerk subject parsed out of
 *      the token identifier. This exists for MCP clients: they authenticate
 *      with a Clerk *OAuth access token* rather than a session token, and
 *      while both carry the same `sub`, we can't assume Clerk emits a
 *      byte-identical `iss` for both. Rather than gate the whole MCP feature
 *      on that assumption, resolve by subject when the exact match misses.
 *
 * Both paths land on the same row, so a user who signed up in the browser
 * and then connects an agent is one user, not two.
 */
async function resolveUser(
  ctx: AuthQueryCtx,
  tokenIdentifier: string,
): Promise<Doc<"users"> | null> {
  const exact = await ctx.db
    .query("users")
    .withIndex("by_tokenIdentifier", (q) =>
      q.eq("tokenIdentifier", tokenIdentifier),
    )
    .unique();
  if (exact) return exact;

  const clerkUserId = parseClerkUserId(tokenIdentifier);
  if (!clerkUserId) return null;
  return await ctx.db
    .query("users")
    .withIndex("by_clerkUserId", (q) => q.eq("clerkUserId", clerkUserId))
    .unique();
}

/**
 * Authenticates the caller and loads their `users` row. Lazily backfills
 * `clerkUserId` for legacy users so downstream Convex actions can call
 * Clerk's backend SDK without having to reparse `tokenIdentifier`.
 */
export async function getCurrentUser(ctx: AuthDbCtx): Promise<Doc<"users">> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new Error("Not authenticated");
  }

  const user = await resolveUser(ctx, identity.tokenIdentifier);

  if (!user) {
    throw new Error("User not found. Please sign in first.");
  }

  // Lazy backfill: legacy rows predate the `clerkUserId` field. We parse
  // it from the trusted `tokenIdentifier` and pin it once so the cost is
  // amortised across all future requests for this user.
  if (!user.clerkUserId) {
    const clerkUserId = parseClerkUserId(identity.tokenIdentifier);
    if (clerkUserId) {
      await ctx.db.patch(user._id, { clerkUserId });
      user.clerkUserId = clerkUserId;
    }
  }

  return user;
}

/**
 * Read-only twin of {@link getCurrentUser} for query handlers. Returns
 * `null` when the request is unauthenticated or the user row hasn't been
 * created yet so UI queries can render empty states rather than throwing.
 *
 * Does NOT lazy-backfill `clerkUserId` (queries are read-only). The
 * backfill happens the next time the user hits a mutation — every authed
 * flow does so within seconds, so reads can stay clean.
 */
export async function getAuthedUserOrNull(
  ctx: AuthQueryCtx,
): Promise<Doc<"users"> | null> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return null;
  return await resolveUser(ctx, identity.tokenIdentifier);
}

/**
 * Resolves a user's GitHub access token. Two-tier fallback so the same
 * function works for both OAuth-connected and PAT-only users:
 *
 *   1. Clerk OAuth — fresh token via the backend SDK. Authoritative when
 *      the user connected GitHub through Clerk; the token's scopes match
 *      what they granted in the OAuth consent screen.
 *   2. Vault PAT — `secretStore._read(user.githubVaultSecretId)`. Power-
 *      user override for bot accounts, fine-grained PATs, or anyone who
 *      isn't using Clerk OAuth.
 *
 * Returns null only when neither tier yields a token; callers throw
 * a friendly error and surface "Reconnect GitHub or set a PAT".
 *
 * Must be called from a Convex action — the vault and Clerk SDKs are
 * Node-only.
 */
export async function getGithubToken(
  ctx: ActionCtx,
  userId: Id<"users">,
): Promise<string | null> {
  const user = await ctx.runQuery(internal.account.users.internalGet, {
    userId,
  });
  if (!user) return null;

  // 1. Clerk OAuth — the live, authoritative source for OAuth users.
  if (user.clerkUserId) {
    const oauthToken = await ctx.runAction(
      internal.integrations.clerk._getGithubOauthToken,
      { clerkUserId: user.clerkUserId },
    );
    if (oauthToken) return oauthToken;
    // Fall through — user may have disconnected GitHub in Clerk but still
    // has a PAT in the vault.
  }

  // 2. Vault PAT — manual override. Fail closed on read errors: a transient
  // WorkOS outage must not silently downgrade the user to a stale legacy
  // token (which is what the previous code did). The caller surfaces the
  // error with a "Reconnect GitHub or try again" message.
  if (user.githubVaultSecretId) {
    return await ctx.runAction(internal.integrations.secretStore._read, {
      id: user.githubVaultSecretId,
    });
  }

  return null;
}
