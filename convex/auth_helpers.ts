import type { Doc } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";

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
