/**
 * Non-Node database helpers for `media/credentials`.
 *
 * Convex requires queries and mutations to live in files without the
 * `"use node"` directive. This module holds the public query and the
 * internal queries / mutations that callers in `media/credentials.ts`
 * (Node-only actions) and `workflows/rotateCredential.ts` depend on.
 */
import { v } from "convex/values";
import { internalMutation, internalQuery, query } from "../_generated/server";
import { getAuthedUserOrNull } from "../_lib/auth";

const PROVIDER_VALIDATOR = v.union(
  v.literal("uploadthing"),
  v.literal("cloudinary"),
);

/**
 * Public read for the settings UI. Never returns the secret — only the
 * opaque status fields the UI needs to render verification chips.
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
      .query("mediaCredentials")
      .withIndex("by_projectId_and_provider", (q) =>
        q.eq("projectId", args.projectId).eq("provider", args.provider),
      )
      .unique();
    if (!cred) return null;

    return {
      _id: cred._id,
      provider: cred.provider,
      publicConfig: cred.publicConfig,
      status: cred.status,
      lastVerifiedAt: cred.lastVerifiedAt,
      lastVerifyError: cred.lastVerifyError,
      rotatedAt: cred.rotatedAt,
      createdAt: cred.createdAt,
      updatedAt: cred.updatedAt,
    };
  },
});

/**
 * Lists all configured credentials for a project (uploadthing, cloudinary).
 * Returns at most one entry per provider. Never includes secrets.
 */
export const listForProject = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    const user = await getAuthedUserOrNull(ctx);
    if (!user) return [];
    const project = await ctx.db.get(args.projectId);
    if (!project || project.userId !== user._id) return [];

    const rows = await ctx.db
      .query("mediaCredentials")
      .withIndex("by_projectId", (q) => q.eq("projectId", args.projectId))
      .collect();
    return rows.map((r) => ({
      _id: r._id,
      provider: r.provider,
      publicConfig: r.publicConfig,
      status: r.status,
      lastVerifiedAt: r.lastVerifiedAt,
      lastVerifyError: r.lastVerifyError,
      rotatedAt: r.rotatedAt,
    }));
  },
});

/* ------------------------------------------------------------------ */
/*  Internal queries / mutations consumed by actions and workflows.    */
/* ------------------------------------------------------------------ */

export const _findByProjectAndProvider = internalQuery({
  args: {
    projectId: v.id("projects"),
    provider: PROVIDER_VALIDATOR,
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("mediaCredentials")
      .withIndex("by_projectId_and_provider", (q) =>
        q.eq("projectId", args.projectId).eq("provider", args.provider),
      )
      .unique();
  },
});

export const _findById = internalQuery({
  args: { credentialId: v.id("mediaCredentials") },
  handler: async (ctx, args) => ctx.db.get(args.credentialId),
});

export const _insert = internalMutation({
  args: {
    projectId: v.id("projects"),
    userId: v.id("users"),
    provider: PROVIDER_VALIDATOR,
    vaultSecretId: v.string(),
    vaultVersionId: v.optional(v.string()),
    publicConfig: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    return await ctx.db.insert("mediaCredentials", {
      projectId: args.projectId,
      userId: args.userId,
      provider: args.provider,
      vaultSecretId: args.vaultSecretId,
      ...(args.vaultVersionId !== undefined
        ? { vaultVersionId: args.vaultVersionId }
        : {}),
      ...(args.publicConfig !== undefined
        ? { publicConfig: args.publicConfig }
        : {}),
      status: "verifying" as const,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const _replaceVaultId = internalMutation({
  args: {
    credentialId: v.id("mediaCredentials"),
    newVaultSecretId: v.string(),
    newVersionId: v.optional(v.string()),
    publicConfig: v.optional(v.string()),
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
    if (args.publicConfig !== undefined) {
      patch["publicConfig"] = args.publicConfig;
    }
    await ctx.db.patch(args.credentialId, patch);
  },
});

export const _setStatus = internalMutation({
  args: {
    credentialId: v.id("mediaCredentials"),
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
    credentialId: v.id("mediaCredentials"),
    newVaultSecretId: v.string(),
    newVersionId: v.optional(v.string()),
    publicConfig: v.optional(v.string()),
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
    if (args.publicConfig !== undefined) {
      patch["publicConfig"] = args.publicConfig;
    }
    await ctx.db.patch(args.credentialId, patch);
  },
});

export const _delete = internalMutation({
  args: { credentialId: v.id("mediaCredentials") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.credentialId);
  },
});
