import { v } from "convex/values";
import { internal } from "../_generated/api";
import {
  action,
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "../_generated/server";
import {
  getAuthedUserOrNull,
  getCurrentUser,
  parseClerkUserId,
} from "../_lib/auth";
import { compressionSettingsValidator } from "../_lib/compression";
import { getRateLimitKey, rateLimiter } from "../_lib/rateLimits";

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
    const key = await getRateLimitKey(ctx);
    await rateLimiter.limit(ctx, "users:getOrCreate", { key, throws: true });

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
      // Backfill `clerkUserId` for legacy users (created before the field
      // was added). Without this, anyone whose only post-schema interaction
      // is `getOrCreate` (clients that don't go through `getCurrentUser`)
      // would stay on the vault-only path forever.
      if (!existing.clerkUserId) {
        const clerkUserId = parseClerkUserId(identity.tokenIdentifier);
        if (clerkUserId) {
          await ctx.db.patch(existing._id, { clerkUserId });
        }
      }
      return existing._id;
    }

    const insertData: {
      tokenIdentifier: string;
      clerkUserId?: string;
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

    const clerkUserId = parseClerkUserId(identity.tokenIdentifier);
    if (clerkUserId) {
      insertData.clerkUserId = clerkUserId;
    }

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
    return await getAuthedUserOrNull(ctx);
  },
});

/**
 * Stores the user's GitHub PAT in the secret vault and pins the opaque ID
 * on the user record. Replaces any prior stored token (vault entry is
 * deleted if rotation is needed).
 *
 * Implemented as an action because the vault SDK runs in Node.
 */
export const updateGithubToken = action({
  args: { token: v.string() },
  handler: async (ctx, args): Promise<void> => {
    const key = await getRateLimitKey(ctx);
    await rateLimiter.limit(ctx, "users:updateGithubToken", {
      key,
      throws: true,
    });
    await rateLimiter.limit(ctx, "vault:write", { key, throws: true });

    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const user = await ctx.runQuery(internal.account.users.internalGetByToken, {
      tokenIdentifier: identity.tokenIdentifier,
    });
    if (!user) {
      throw new Error("User not found");
    }

    // Store new value in vault first, then swap pointer on the user row,
    // then best-effort delete the old vault entry.
    const created = await ctx.runAction(
      internal.integrations.secretStore._create,
      {
        value: args.token,
        meta: {
          userId: user._id,
          label: "github-pat",
        },
      },
    );

    const previousVaultId = user.githubVaultSecretId;
    await ctx.runMutation(internal.account.users._setGithubVaultId, {
      userId: user._id,
      vaultSecretId: created.id,
    });

    if (previousVaultId) {
      try {
        await ctx.runAction(internal.integrations.secretStore._delete, {
          id: previousVaultId,
        });
      } catch {
        // Vault entry may already be gone; ignore.
      }
    }
  },
});

/**
 * Saves or clears the account-wide default for client-side image compression.
 * Pass an object to set it; pass `null` to clear it and let the client fall
 * back to the built-in defaults.
 */
export const updateDefaultCompressionSettings = mutation({
  args: {
    settings: v.union(compressionSettingsValidator, v.null()),
  },
  handler: async (ctx, args) => {
    const key = await getRateLimitKey(ctx);
    await rateLimiter.limit(ctx, "users:updateDefaultCompressionSettings", {
      key,
      throws: true,
    });

    const user = await getCurrentUser(ctx);
    await ctx.db.patch(user._id, {
      defaultCompressionSettings: args.settings ?? undefined,
    });
  },
});

/**
 * Stores the user's GitHub username for display and identification purposes.
 */
export const updateGithubUsername = mutation({
  args: { username: v.string() },
  handler: async (ctx, args) => {
    const key = await getRateLimitKey(ctx);
    await rateLimiter.limit(ctx, "users:updateGithubUsername", {
      key,
      throws: true,
    });

    const user = await getCurrentUser(ctx);
    await ctx.db.patch(user._id, {
      githubUsername: args.username,
    });
  },
});

/**
 * Internal-only query to fetch a user by ID. Used by server-side actions
 * that already have a trusted userId and don't need to re-authenticate.
 */
export const internalGet = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.userId);
  },
});

/** Internal user lookup by Clerk token, for actions that can't query directly. */
export const internalGetByToken = internalQuery({
  args: { tokenIdentifier: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("users")
      .withIndex("by_tokenIdentifier", (q) =>
        q.eq("tokenIdentifier", args.tokenIdentifier),
      )
      .unique();
  },
});

/**
 * Sets the vault-backed GitHub secret pointer and clears any legacy plaintext
 * `githubAccessToken` value. Internal because it's invoked from the
 * `updateGithubToken` action and from `getGithubToken`'s lazy migration path.
 */
export const _setGithubVaultId = internalMutation({
  args: {
    userId: v.id("users"),
    vaultSecretId: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.userId, {
      githubVaultSecretId: args.vaultSecretId,
      githubAccessToken: undefined,
    });
  },
});
