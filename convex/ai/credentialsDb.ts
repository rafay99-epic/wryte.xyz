/**
 * Non-Node database helpers for `ai/credentials`.
 *
 * Mirrors `convex/media/credentialsDb.ts` exactly — split out so the
 * Node-only action file can call into these via `ctx.runQuery` /
 * `ctx.runMutation`.
 */
import { v } from "convex/values";
import { internalMutation, internalQuery, query } from "../_generated/server";
import { getAuthedUserOrNull } from "../_lib/auth";

const PROVIDER_VALIDATOR = v.union(
  v.literal("anthropic"),
  v.literal("openai"),
  v.literal("openrouter"),
);

/**
 * Public read for the settings UI. Never returns the secret — only the
 * fields the UI needs to render verification chips.
 */
export const getPublicConfig = query({
  args: {
    projectId: v.id("projects"),
    provider: PROVIDER_VALIDATOR,
  },
  handler: async (ctx, args) => {
    const user = await getAuthedUserOrNull(ctx);
    if (!user) return null;

    const project = await ctx.db.get(args.projectId);
    if (!project || project.userId !== user._id) return null;

    const cred = await ctx.db
      .query("aiCredentials")
      .withIndex("by_projectId_and_provider", (q) =>
        q.eq("projectId", args.projectId).eq("provider", args.provider),
      )
      .unique();
    if (!cred) return null;

    return {
      _id: cred._id,
      provider: cred.provider,
      status: cred.status,
      lastVerifiedAt: cred.lastVerifiedAt,
      lastVerifyError: cred.lastVerifyError,
      rotatedAt: cred.rotatedAt,
      createdAt: cred.createdAt,
      updatedAt: cred.updatedAt,
    };
  },
});

/* ------------------------------------------------------------------ */
/*  Internal queries / mutations                                         */
/* ------------------------------------------------------------------ */

export const _findByProjectAndProvider = internalQuery({
  args: {
    projectId: v.id("projects"),
    provider: PROVIDER_VALIDATOR,
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("aiCredentials")
      .withIndex("by_projectId_and_provider", (q) =>
        q.eq("projectId", args.projectId).eq("provider", args.provider),
      )
      .unique();
  },
});

export const _findById = internalQuery({
  args: { credentialId: v.id("aiCredentials") },
  handler: async (ctx, args) => ctx.db.get(args.credentialId),
});

export const _insert = internalMutation({
  args: {
    projectId: v.id("projects"),
    userId: v.id("users"),
    provider: PROVIDER_VALIDATOR,
    vaultSecretId: v.string(),
    vaultVersionId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    return await ctx.db.insert("aiCredentials", {
      projectId: args.projectId,
      userId: args.userId,
      provider: args.provider,
      vaultSecretId: args.vaultSecretId,
      ...(args.vaultVersionId !== undefined
        ? { vaultVersionId: args.vaultVersionId }
        : {}),
      status: "verifying" as const,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const _replaceVaultId = internalMutation({
  args: {
    credentialId: v.id("aiCredentials"),
    newVaultSecretId: v.string(),
    newVersionId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const patch: Record<string, unknown> = {
      vaultSecretId: args.newVaultSecretId,
      status: "verifying" as const,
      updatedAt: Date.now(),
    };
    if (args.newVersionId !== undefined) {
      patch["vaultVersionId"] = args.newVersionId;
    }
    await ctx.db.patch(args.credentialId, patch);
  },
});

export const _setStatus = internalMutation({
  args: {
    credentialId: v.id("aiCredentials"),
    status: v.union(
      v.literal("active"),
      v.literal("verifying"),
      v.literal("invalid"),
      v.literal("rotating"),
    ),
    lastVerifyError: v.optional(v.string()),
    lastVerifiedAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const patch: Record<string, unknown> = {
      status: args.status,
      updatedAt: Date.now(),
    };
    if (args.lastVerifyError !== undefined) {
      patch["lastVerifyError"] = args.lastVerifyError;
    } else if (args.status === "active") {
      patch["lastVerifyError"] = undefined;
    }
    if (args.lastVerifiedAt !== undefined) {
      patch["lastVerifiedAt"] = args.lastVerifiedAt;
    }
    await ctx.db.patch(args.credentialId, patch);
  },
});

export const _markRotated = internalMutation({
  args: {
    credentialId: v.id("aiCredentials"),
    newVaultSecretId: v.string(),
    newVersionId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const patch: Record<string, unknown> = {
      vaultSecretId: args.newVaultSecretId,
      status: "active" as const,
      rotatedAt: now,
      lastVerifiedAt: now,
      lastVerifyError: undefined,
      updatedAt: now,
    };
    if (args.newVersionId !== undefined) {
      patch["vaultVersionId"] = args.newVersionId;
    }
    await ctx.db.patch(args.credentialId, patch);
  },
});

export const _delete = internalMutation({
  args: { credentialId: v.id("aiCredentials") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.credentialId);
  },
});
