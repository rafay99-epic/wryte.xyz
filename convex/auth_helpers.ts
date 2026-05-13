import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import type { ActionCtx, MutationCtx } from "./_generated/server";

/** Minimal Convex mutation context slice needed for user lookup. */
export type AuthDbCtx = Pick<MutationCtx, "auth" | "db">;

/**
 * Authenticates the caller and loads their `users` row.
 * Shared by mutations that require a confirmed identity.
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

  return user;
}

/**
 * Resolves a user's GitHub access token from the vault.
 *
 * Handles three states transparently:
 *  1. `githubVaultSecretId` is set — reads via the vault and returns the token.
 *  2. Only the legacy `githubAccessToken` is set — migrates lazily to the
 *     vault, clears the plaintext field, returns the token.
 *  3. Neither is set — returns null so callers can surface a friendly
 *     "Reconnect GitHub" message.
 *
 * Must be called from a Convex action (the vault SDK is Node-only). The
 * `userId` is enough; the action does the rest via internal helpers.
 */
export async function getGithubToken(
  ctx: ActionCtx,
  userId: Id<"users">,
): Promise<string | null> {
  const user = await ctx.runQuery(internal.users.internalGet, { userId });
  if (!user) return null;

  if (user.githubVaultSecretId) {
    return await ctx.runAction(internal.secretStore._read, {
      id: user.githubVaultSecretId,
    });
  }

  if (user.githubAccessToken) {
    // Lazy migration: stash the plaintext into the vault, swap pointer.
    const created = await ctx.runAction(internal.secretStore._create, {
      value: user.githubAccessToken,
      meta: {
        userId: user._id,
        label: "github-pat-migrated",
      },
    });
    await ctx.runMutation(internal.users._setGithubVaultId, {
      userId: user._id,
      vaultSecretId: created.id,
    });
    return user.githubAccessToken;
  }

  return null;
}
