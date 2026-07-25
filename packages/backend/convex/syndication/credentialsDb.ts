/**
 * Non-Node database helpers for `syndication/credentials`.
 *
 * Mirrors `convex/social/credentialsDb.ts` — split so the Node-only action
 * file can call into these via `ctx.runQuery` / `ctx.runMutation`.
 */
import { v } from "convex/values";
import { internalMutation, internalQuery, query } from "../_generated/server";
import { getAuthedUserOrNull } from "../_lib/auth";
import { syndicationProviderValidator } from "./_lib/providers";

const STATUS_VALIDATOR = v.union(
  v.literal("active"),
  v.literal("verifying"),
  v.literal("invalid"),
  v.literal("rotating"),
);

const PUBLIC_ROW = v.object({
  _id: v.id("syndicationCredentials"),
  provider: syndicationProviderValidator,
  publicConfig: v.optional(v.string()),
  status: STATUS_VALIDATOR,
  lastVerifiedAt: v.optional(v.number()),
  lastVerifyError: v.optional(v.string()),
  createdAt: v.number(),
  updatedAt: v.number(),
});

/** Both provider rows for the settings section — never includes the secret. */
export const getPublicConfig = query({
  args: { projectId: v.id("projects") },
  returns: v.array(PUBLIC_ROW),
  handler: async (ctx, args) => {
    const user = await getAuthedUserOrNull(ctx);
    if (!user) return [];
    const project = await ctx.db.get(args.projectId);
    if (!project || project.userId !== user._id) return [];

    const rows = await ctx.db
      .query("syndicationCredentials")
      .withIndex("by_projectId", (q) => q.eq("projectId", args.projectId))
      .take(10);
    return rows.map((cred) => ({
      _id: cred._id,
      provider: cred.provider,
      ...(cred.publicConfig !== undefined
        ? { publicConfig: cred.publicConfig }
        : {}),
      status: cred.status,
      ...(cred.lastVerifiedAt !== undefined
        ? { lastVerifiedAt: cred.lastVerifiedAt }
        : {}),
      ...(cred.lastVerifyError !== undefined
        ? { lastVerifyError: cred.lastVerifyError }
        : {}),
      createdAt: cred.createdAt,
      updatedAt: cred.updatedAt,
    }));
  },
});

/* ------------------------------------------------------------------ */
/*  Internal queries / mutations                                       */
/* ------------------------------------------------------------------ */

const CREDENTIAL_DOC = v.object({
  _id: v.id("syndicationCredentials"),
  _creationTime: v.number(),
  projectId: v.id("projects"),
  userId: v.id("users"),
  provider: syndicationProviderValidator,
  vaultSecretId: v.string(),
  vaultVersionId: v.optional(v.string()),
  publicConfig: v.optional(v.string()),
  status: STATUS_VALIDATOR,
  lastVerifiedAt: v.optional(v.number()),
  lastVerifyError: v.optional(v.string()),
  rotatedAt: v.optional(v.number()),
  createdAt: v.number(),
  updatedAt: v.number(),
});

export const _findByProject = internalQuery({
  args: {
    projectId: v.id("projects"),
    provider: syndicationProviderValidator,
  },
  returns: v.union(v.null(), CREDENTIAL_DOC),
  handler: async (ctx, args) => {
    return await ctx.db
      .query("syndicationCredentials")
      .withIndex("by_projectId_and_provider", (q) =>
        q.eq("projectId", args.projectId).eq("provider", args.provider),
      )
      .unique();
  },
});

export const _insert = internalMutation({
  args: {
    projectId: v.id("projects"),
    userId: v.id("users"),
    provider: syndicationProviderValidator,
    vaultSecretId: v.string(),
    vaultVersionId: v.optional(v.string()),
    publicConfig: v.optional(v.string()),
  },
  returns: v.id("syndicationCredentials"),
  handler: async (ctx, args) => {
    const now = Date.now();
    return await ctx.db.insert("syndicationCredentials", {
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
    credentialId: v.id("syndicationCredentials"),
    newVaultSecretId: v.string(),
    newVersionId: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const patch: Record<string, unknown> = {
      vaultSecretId: args.newVaultSecretId,
      rotatedAt: Date.now(),
      updatedAt: Date.now(),
    };
    if (args.newVersionId !== undefined) {
      patch["vaultVersionId"] = args.newVersionId;
    }
    await ctx.db.patch(args.credentialId, patch);
    return null;
  },
});

export const _updatePublicConfig = internalMutation({
  args: {
    credentialId: v.id("syndicationCredentials"),
    publicConfig: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.credentialId, {
      publicConfig: args.publicConfig,
      updatedAt: Date.now(),
    });
    return null;
  },
});

export const _setStatus = internalMutation({
  args: {
    credentialId: v.id("syndicationCredentials"),
    status: STATUS_VALIDATOR,
    lastVerifyError: v.optional(v.string()),
    lastVerifiedAt: v.optional(v.number()),
  },
  returns: v.null(),
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
    return null;
  },
});

export const _delete = internalMutation({
  args: { credentialId: v.id("syndicationCredentials") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.delete(args.credentialId);
    return null;
  },
});
