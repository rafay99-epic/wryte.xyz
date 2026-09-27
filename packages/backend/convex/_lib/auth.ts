import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import type { ActionCtx, MutationCtx, QueryCtx } from "../_generated/server";

export type AuthDbCtx = Pick<MutationCtx, "auth" | "db">;

export type AuthQueryCtx = Pick<QueryCtx, "auth" | "db">;

export function parseClerkUserId(tokenIdentifier: string): string | null {
  const parts = tokenIdentifier.split("|");
  const last = parts[parts.length - 1] ?? "";
  return last.startsWith("user_") ? last : null;
}

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

export async function getCurrentUser(ctx: AuthDbCtx): Promise<Doc<"users">> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new Error("Not authenticated");
  }

  const user = await resolveUser(ctx, identity.tokenIdentifier);

  if (!user) {
    throw new Error("User not found. Please sign in first.");
  }

  if (!user.clerkUserId) {
    const clerkUserId = parseClerkUserId(identity.tokenIdentifier);
    if (clerkUserId) {
      await ctx.db.patch(user._id, { clerkUserId });
      user.clerkUserId = clerkUserId;
    }
  }

  return user;
}

export async function getAuthedUserOrNull(
  ctx: AuthQueryCtx,
): Promise<Doc<"users"> | null> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return null;
  return await resolveUser(ctx, identity.tokenIdentifier);
}

export async function getGithubToken(
  ctx: ActionCtx,
  userId: Id<"users">,
): Promise<string | null> {
  const user = await ctx.runQuery(internal.account.users.internalGet, {
    userId,
  });
  if (!user) return null;

  if (user.clerkUserId) {
    const oauthToken = await ctx.runAction(
      internal.integrations.clerk._getGithubOauthToken,
      { clerkUserId: user.clerkUserId },
    );
    if (oauthToken) return oauthToken;
  }

  if (user.githubVaultSecretId) {
    return await ctx.runAction(internal.integrations.secretStore._read, {
      id: user.githubVaultSecretId,
    });
  }

  return null;
}
