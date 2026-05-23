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
 * Authenticates the caller and loads their `users` row. Lazily backfills
 * `clerkUserId` for legacy users so downstream Convex actions can call
 * Clerk's backend SDK without having to reparse `tokenIdentifier`.
 */
export async function getCurrentUser(ctx: AuthDbCtx): Promise<Doc<"users">> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new Error("Not authenticated");
  }

  const user = await ctx.db
    .query("users")
    .withIndex("by_tokenIdentifier", (q) =>
      q.eq("tokenIdentifier", identity.tokenIdentifier),
    )
    .unique();

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
  return await ctx.db
    .query("users")
    .withIndex("by_tokenIdentifier", (q) =>
      q.eq("tokenIdentifier", identity.tokenIdentifier),
    )
    .unique();
}

/**
 * Resolves a user's GitHub access token. Three-tier fallback so the same
 * function works for both OAuth-connected and PAT-only users:
 *
 *   1. Clerk OAuth — fresh token via the backend SDK. Authoritative when
 *      the user connected GitHub through Clerk; the token's scopes match
 *      what they granted in the OAuth consent screen.
 *   2. Vault PAT — `secretStore._read(user.githubVaultSecretId)`. Power-
 *      user override for bot accounts, fine-grained PATs, or anyone who
 *      isn't using Clerk OAuth.
 *   3. Legacy plaintext — `user.githubAccessToken`. Migrated into the
 *      vault on the first read so this branch retires itself over time.
 *
 * Returns null only when none of the three yields a token; callers throw
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

  // 3. Legacy plaintext — lazy migrate into the vault on first read. After
  //    migration the next call goes through the vault branch above. Only
  //    reached when the user has no vault entry yet.
  if (user.githubAccessToken) {
    const created = await ctx.runAction(
      internal.integrations.secretStore._create,
      {
        value: user.githubAccessToken,
        meta: {
          userId: user._id,
          label: "github-pat-migrated",
        },
      },
    );
    await ctx.runMutation(internal.account.users._setGithubVaultId, {
      userId: user._id,
      vaultSecretId: created.id,
    });
    return user.githubAccessToken;
  }

  return null;
}
