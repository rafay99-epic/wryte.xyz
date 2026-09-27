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

export const get = query({
  args: {},
  handler: async (ctx) => {
    return await getAuthedUserOrNull(ctx);
  },
});

export const updateGithubToken = action({
  args: { token: v.string() },
  handler: async (ctx, args): Promise<void> => {
    const key = await getRateLimitKey(ctx);
    await rateLimiter.limit(ctx, "users:updateGithubToken", {
      key,
      throws: true,
    });
    await rateLimiter.limit(ctx, "vault:write", { key, throws: true });

    const token = args.token.trim();
    if (!token) {
      throw new Error("Token is required");
    }
    if (token.length > 256) {
      throw new Error("Token is too long");
    }
    if (!/^(ghp_|gho_|ghu_|ghs_|ghr_|github_pat_)/.test(token)) {
      throw new Error(
        "Token does not look like a GitHub PAT (expected ghp_/gho_/ghu_/ghs_/ghr_/github_pat_ prefix).",
      );
    }

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

    const created = await ctx.runAction(
      internal.integrations.secretStore._create,
      {
        value: token,
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
      } catch {}
    }
  },
});

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

export const internalGet = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.userId);
  },
});

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

export const internalGetByClerkId = internalQuery({
  args: { clerkUserId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("users")
      .withIndex("by_clerkUserId", (q) => q.eq("clerkUserId", args.clerkUserId))
      .unique();
  },
});

export const _setGithubVaultId = internalMutation({
  args: {
    userId: v.id("users"),
    vaultSecretId: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.userId, {
      githubVaultSecretId: args.vaultSecretId,
    });
  },
});
