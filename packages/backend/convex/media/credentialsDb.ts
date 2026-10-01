import { v } from "convex/values";
import { internalMutation, internalQuery, query } from "../_generated/server";
import { getAuthedUserOrNull } from "../_lib/auth";
import type { DocPatch } from "../_lib/docPatch";
import { findCredential, loadNoteSettings } from "./_lib/noteSource";
import {
  CREDENTIAL_PROVIDER_IDS,
  credentialProviderValidator,
  MEDIA_PROVIDER_IDS,
  type MediaCredentialStatus,
  type MediaProvider,
  resolveDefaultProvider,
} from "./_lib/providers";

const PROVIDER_VALIDATOR = credentialProviderValidator;

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
      .take(CREDENTIAL_PROVIDER_IDS.length);
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

export type EnabledProvider = {
  provider: MediaProvider;
  isDefault: boolean;
  configured: boolean;
  status?: MediaCredentialStatus;
};

export const listEnabledProviders = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args): Promise<EnabledProvider[]> => {
    const user = await getAuthedUserOrNull(ctx);
    if (!user) return [];
    const project = await ctx.db.get(args.projectId);
    if (!project || project.userId !== user._id) return [];

    const rows = await ctx.db
      .query("mediaCredentials")
      .withIndex("by_projectId", (q) => q.eq("projectId", args.projectId))
      .take(CREDENTIAL_PROVIDER_IDS.length);
    const byProvider = new Map<MediaProvider, (typeof rows)[number]>(
      rows.map((r) => [r.provider, r]),
    );

    const defaultProvider = resolveDefaultProvider(project.mediaStorageMode);
    const githubReady = Boolean(project.githubRepo && project.mediaPath);

    const enabled: EnabledProvider[] = [];
    for (const provider of MEDIA_PROVIDER_IDS) {
      const isDefault = provider === defaultProvider;
      const cred = byProvider.get(provider);
      const configured =
        provider === "github" ? githubReady : cred !== undefined;
      if (!configured && !isDefault) continue;
      enabled.push({
        provider,
        isDefault,
        configured,
        ...(cred ? { status: cred.status } : {}),
      });
    }
    return enabled;
  },
});

export const _findByScope = internalQuery({
  args: {
    userId: v.id("users"),
    projectId: v.optional(v.id("projects")),
    provider: PROVIDER_VALIDATOR,
  },
  handler: async (ctx, args) =>
    await findCredential(
      ctx,
      { userId: args.userId, projectId: args.projectId },
      args.provider,
    ),
});

export const _usedByNotes = internalQuery({
  args: { userId: v.id("users"), provider: PROVIDER_VALIDATOR },
  handler: async (ctx, args): Promise<boolean> => {
    const media = (await loadNoteSettings(ctx, args.userId))?.media;
    return media?.kind === "own" && media.provider === args.provider;
  },
});

export const _findById = internalQuery({
  args: { credentialId: v.id("mediaCredentials") },
  handler: async (ctx, args) => ctx.db.get(args.credentialId),
});

export const _insert = internalMutation({
  args: {
    projectId: v.optional(v.id("projects")),
    userId: v.id("users"),
    provider: PROVIDER_VALIDATOR,
    vaultSecretId: v.string(),
    vaultVersionId: v.optional(v.string()),
    publicConfig: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    return await ctx.db.insert("mediaCredentials", {
      ...(args.projectId !== undefined ? { projectId: args.projectId } : {}),
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
    clearPublicConfig: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const patch: DocPatch<"mediaCredentials"> = {
      vaultSecretId: args.newVaultSecretId,
      status: "verifying" as const,
      updatedAt: Date.now(),
    };
    if (args.newVersionId !== undefined) {
      patch.vaultVersionId = args.newVersionId;
    }
    if (args.clearPublicConfig) patch.publicConfig = undefined;
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
    const patch: DocPatch<"mediaCredentials"> = {
      status: args.status,
      updatedAt: Date.now(),
    };
    if (args.lastVerifyError !== undefined) {
      patch.lastVerifyError = args.lastVerifyError;
    } else if (args.status === "active") {
      patch.lastVerifyError = undefined;
    }
    if (args.lastVerifiedAt !== undefined) {
      patch.lastVerifiedAt = args.lastVerifiedAt;
    }
    await ctx.db.patch(args.credentialId, patch);
  },
});

export const _markRotated = internalMutation({
  args: {
    credentialId: v.id("mediaCredentials"),
    newVaultSecretId: v.string(),
    newVersionId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const patch: DocPatch<"mediaCredentials"> = {
      vaultSecretId: args.newVaultSecretId,
      status: "active" as const,
      rotatedAt: now,
      lastVerifiedAt: now,
      lastVerifyError: undefined,
      updatedAt: now,
    };
    if (args.newVersionId !== undefined) {
      patch.vaultVersionId = args.newVersionId;
    }
    patch.publicConfig = undefined;
    await ctx.db.patch(args.credentialId, patch);
  },
});

export const _delete = internalMutation({
  args: { credentialId: v.id("mediaCredentials") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.credentialId);
  },
});
