/**
 * Non-Node database helpers for `social/credentials`.
 *
 * Mirrors `convex/ai/credentialsDb.ts` — split so the Node-only action
 * file can call into these via `ctx.runQuery` / `ctx.runMutation`.
 */
import { v } from "convex/values";
import { internalMutation, internalQuery, query } from "../_generated/server";
import { getAuthedUserOrNull } from "../_lib/auth";

const PROVIDER_VALIDATOR = v.union(
  v.literal("upload-post"),
  v.literal("buffer"),
);

const STATUS_VALIDATOR = v.union(
  v.literal("active"),
  v.literal("verifying"),
  v.literal("invalid"),
  v.literal("rotating"),
);

export const getPublicConfig = query({
  args: {
    projectId: v.id("projects"),
  },
  returns: v.union(
    v.null(),
    v.object({ hasLegacyUploadPost: v.literal(true) }),
    v.object({
      _id: v.id("socialCredentials"),
      provider: PROVIDER_VALIDATOR,
      publicConfig: v.optional(v.string()),
      status: STATUS_VALIDATOR,
      lastVerifiedAt: v.optional(v.number()),
      lastVerifyError: v.optional(v.string()),
      rotatedAt: v.optional(v.number()),
      createdAt: v.number(),
      updatedAt: v.number(),
      hasLegacyUploadPost: v.boolean(),
    }),
  ),
  handler: async (ctx, args) => {
    const user = await getAuthedUserOrNull(ctx);
    if (!user) return null;

    const project = await ctx.db.get(args.projectId);
    if (!project || project.userId !== user._id) return null;

    const cred = await ctx.db
      .query("socialCredentials")
      .withIndex("by_projectId_and_provider", (q) =>
        q.eq("projectId", args.projectId).eq("provider", "buffer"),
      )
      .unique();

    // Legacy Upload-Post row (posting through it is retired) — surfaced so
    // the settings UI can show a "reconnect with Buffer" migration prompt.
    const legacy = await ctx.db
      .query("socialCredentials")
      .withIndex("by_projectId_and_provider", (q) =>
        q.eq("projectId", args.projectId).eq("provider", "upload-post"),
      )
      .unique();

    if (!cred) return legacy ? { hasLegacyUploadPost: true as const } : null;

    return {
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
      ...(cred.rotatedAt !== undefined ? { rotatedAt: cred.rotatedAt } : {}),
      createdAt: cred.createdAt,
      updatedAt: cred.updatedAt,
      hasLegacyUploadPost: legacy !== null,
    };
  },
});

/* ------------------------------------------------------------------ */
/*  Internal queries / mutations                                       */
/* ------------------------------------------------------------------ */

/** Full socialCredentials row — return shape of the internal find queries. */
const CREDENTIAL_DOC = v.object({
  _id: v.id("socialCredentials"),
  _creationTime: v.number(),
  projectId: v.id("projects"),
  userId: v.id("users"),
  provider: PROVIDER_VALIDATOR,
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
    provider: PROVIDER_VALIDATOR,
  },
  returns: v.union(v.null(), CREDENTIAL_DOC),
  handler: async (ctx, args) => {
    return await ctx.db
      .query("socialCredentials")
      .withIndex("by_projectId_and_provider", (q) =>
        q.eq("projectId", args.projectId).eq("provider", args.provider),
      )
      .unique();
  },
});

export const _findById = internalQuery({
  args: { credentialId: v.id("socialCredentials") },
  returns: v.union(v.null(), CREDENTIAL_DOC),
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
  returns: v.id("socialCredentials"),
  handler: async (ctx, args) => {
    const now = Date.now();
    return await ctx.db.insert("socialCredentials", {
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

export const _updatePublicConfig = internalMutation({
  args: {
    credentialId: v.id("socialCredentials"),
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

export const _replaceVaultId = internalMutation({
  args: {
    credentialId: v.id("socialCredentials"),
    newVaultSecretId: v.string(),
    newVersionId: v.optional(v.string()),
  },
  returns: v.null(),
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
    return null;
  },
});

export const _setStatus = internalMutation({
  args: {
    credentialId: v.id("socialCredentials"),
    status: v.union(
      v.literal("active"),
      v.literal("verifying"),
      v.literal("invalid"),
      v.literal("rotating"),
    ),
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

export const _markRotated = internalMutation({
  args: {
    credentialId: v.id("socialCredentials"),
    newVaultSecretId: v.string(),
    newVersionId: v.optional(v.string()),
  },
  returns: v.null(),
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
    return null;
  },
});

export const _delete = internalMutation({
  args: { credentialId: v.id("socialCredentials") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.delete(args.credentialId);
    return null;
  },
});
