import { v } from "convex/values";
import {
  query,
  mutation,
  internalQuery,
} from "./_generated/server";

/**
 * Finds the current user by their Clerk token, or creates a new user record
 * if this is their first sign-in. Called on every app load to ensure the
 * Convex users table stays in sync with Clerk.
 *
 * @requires Authentication - throws if not authenticated.
 * @returns The user's Convex document ID (existing or newly created).
 */
export const getOrCreate = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const existing = await ctx.db
      .query("users")
      .withIndex("by_tokenIdentifier", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier),
      )
      .unique();

    if (existing) {
      return existing._id;
    }

    const insertData: {
      tokenIdentifier: string;
      name: string;
      email: string;
      imageUrl?: string;
      createdAt: number;
    } = {
      tokenIdentifier: identity.tokenIdentifier,
      name: identity.name ?? "Anonymous",
      email: identity.email ?? "",
      createdAt: Date.now(),
    };

    if (identity.pictureUrl) {
      insertData.imageUrl = identity.pictureUrl;
    }

    const userId = await ctx.db.insert("users", insertData);

    return userId;
  },
});

/**
 * Retrieves the current authenticated user's full profile.
 * Returns null (rather than throwing) when unauthenticated, allowing
 * the client to render a signed-out state without error handling.
 *
 * @returns The user document, or null if not authenticated / not yet created.
 */
export const get = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return null;
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_tokenIdentifier", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier),
      )
      .unique();

    return user;
  },
});

/**
 * Persists the user's GitHub personal access token for use in publishing.
 * The token is stored on the user record so it can be used by internal
 * actions (e.g., scheduled publishes) that don't have access to client-provided tokens.
 *
 * @requires Authentication - throws if not authenticated or user not found.
 * @param args.token - GitHub personal access token.
 */
export const updateGithubToken = mutation({
  args: { token: v.string() },
  handler: async (ctx, args) => {
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
      throw new Error("User not found");
    }

    await ctx.db.patch(user._id, {
      githubAccessToken: args.token,
    });
  },
});

/**
 * Stores the user's GitHub username for display and identification purposes.
 *
 * @requires Authentication - throws if not authenticated or user not found.
 * @param args.username - GitHub username.
 */
export const updateGithubUsername = mutation({
  args: { username: v.string() },
  handler: async (ctx, args) => {
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
      throw new Error("User not found");
    }

    await ctx.db.patch(user._id, {
      githubUsername: args.username,
    });
  },
});

/**
 * Internal-only query to fetch a user by ID. Used by server-side actions
 * (e.g., github.ts) that already have a trusted userId and don't need
 * to re-authenticate via Clerk.
 *
 * @param args.userId - The Convex user document ID.
 * @returns The user document, or null if not found.
 */
export const internalGet = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.userId);
  },
});
