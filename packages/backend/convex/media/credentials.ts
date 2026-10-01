"use node";

import { ConvexError, v } from "convex/values";
import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import type { ActionCtx } from "../_generated/server";
import { action } from "../_generated/server";
import { getRateLimitKey, rateLimiter } from "../_lib/rateLimits";
import { getAdapter } from "../providers/registry";
import type { CredentialScope } from "./_lib/owner";
import {
  type CredentialProvider,
  credentialProviderValidator,
  getMediaProvider,
} from "./_lib/providers";

const PROVIDER_VALIDATOR = credentialProviderValidator;

type ProviderName = CredentialProvider;

async function mergeWithStoredSecret(
  ctx: ActionCtx,
  provider: ProviderName,
  incoming: string,
  vaultSecretId: string,
  rateKey: string,
): Promise<string> {
  await rateLimiter.limit(ctx, "vault:read", { key: rateKey, throws: true });
  const stored: string = await ctx.runAction(
    internal.integrations.secretStore._read,
    { id: vaultSecretId },
  );

  if (getMediaProvider(provider).secretFormat === "raw") {
    return incoming.trim() === "" ? stored : incoming;
  }

  let storedFields: Record<string, unknown> = {};
  try {
    const parsed: unknown = JSON.parse(stored);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      storedFields = parsed as Record<string, unknown>;
    }
  } catch {}
  let incomingFields: Record<string, unknown> = {};
  try {
    const parsed: unknown = JSON.parse(incoming);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      incomingFields = parsed as Record<string, unknown>;
    }
  } catch {
    throw new ConvexError({
      code: "UNKNOWN" as const,
      message: `${getMediaProvider(provider).label} credentials must be a JSON object.`,
    });
  }
  return JSON.stringify({ ...storedFields, ...incomingFields });
}

export const getEditableConfig = action({
  args: {
    projectId: v.optional(v.id("projects")),
    provider: PROVIDER_VALIDATOR,
  },
  handler: async (ctx, args): Promise<Record<string, string> | null> => {
    const key = await getRateLimitKey(ctx);
    const cred = await loadOwnedCredential(ctx, args.projectId, args.provider);

    await rateLimiter.limit(ctx, "vault:read", { key, throws: true });
    const raw: string = await ctx.runAction(
      internal.integrations.secretStore._read,
      { id: cred.vaultSecretId },
    );

    const entry = getMediaProvider(args.provider);
    if (entry.secretFormat === "raw") return {};

    let parsed: Record<string, unknown>;
    try {
      const candidate: unknown = JSON.parse(raw);
      if (
        !candidate ||
        typeof candidate !== "object" ||
        Array.isArray(candidate)
      ) {
        return {};
      }
      parsed = candidate as Record<string, unknown>;
    } catch {
      return {};
    }

    const out: Record<string, string> = {};
    for (const field of entry.fields) {
      if (field.secret) continue;
      const value = parsed[field.key];
      if (typeof value === "string" && value !== "") out[field.key] = value;
    }
    return out;
  },
});

export const setCredentials = action({
  args: {
    projectId: v.optional(v.id("projects")),
    provider: PROVIDER_VALIDATOR,
    secret: v.string(),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{
    credentialId: Id<"mediaCredentials">;
    ok: boolean;
    code?: string;
    message?: string;
  }> => {
    const key = await getRateLimitKey(ctx);
    await rateLimiter.limit(ctx, "mediaCredentials:set", { key, throws: true });
    await rateLimiter.limit(ctx, "vault:write", { key, throws: true });

    const { scope } = await requireScope(ctx, args.projectId);
    const existing = await findScopedCredential(ctx, scope, args.provider);

    const secret = existing
      ? await mergeWithStoredSecret(
          ctx,
          args.provider,
          args.secret,
          existing.vaultSecretId,
          key,
        )
      : args.secret;

    assertValidSecretShape(args.provider, secret);

    const verify = await runProviderPing(args.provider, secret);
    if (existing && !verify.ok) {
      const failResult: {
        credentialId: Id<"mediaCredentials">;
        ok: false;
        code?: string;
        message?: string;
      } = { credentialId: existing._id, ok: false };
      if (verify.code) failResult.code = verify.code;
      if (verify.message) failResult.message = verify.message;
      return failResult;
    }

    const created = await ctx.runAction(
      internal.integrations.secretStore._create,
      {
        value: secret,
        meta: {
          userId: scope.userId,
          provider: args.provider,
          label: `${args.provider}-creds`,
          ...scopeProject(scope),
        },
      },
    );

    let credentialId: Id<"mediaCredentials">;
    if (existing) {
      credentialId = existing._id;
      const replaceArgs: {
        credentialId: Id<"mediaCredentials">;
        newVaultSecretId: string;
        newVersionId?: string;
        clearPublicConfig?: boolean;
      } = {
        credentialId,
        newVaultSecretId: created.id,
      };
      if (created.versionId !== undefined) {
        replaceArgs.newVersionId = created.versionId;
      }
      replaceArgs.clearPublicConfig = true;
      await ctx.runMutation(
        internal.media.credentialsDb._replaceVaultId,
        replaceArgs,
      );
      try {
        await ctx.runAction(internal.integrations.secretStore._delete, {
          id: existing.vaultSecretId,
        });
      } catch (err) {
        console.warn(
          `[media] failed to delete superseded vault secret ${existing.vaultSecretId} for ${args.provider}:`,
          (err as { message?: string })?.message ?? err,
        );
      }
    } else {
      credentialId = await ctx.runMutation(
        internal.media.credentialsDb._insert,
        {
          userId: scope.userId,
          provider: args.provider,
          vaultSecretId: created.id,
          ...scopeProject(scope),
          ...(created.versionId !== undefined
            ? { vaultVersionId: created.versionId }
            : {}),
        },
      );
    }

    const statusArgs: {
      credentialId: Id<"mediaCredentials">;
      status: "active" | "invalid" | "verifying" | "rotating";
      lastVerifyError?: string;
      lastVerifiedAt?: number;
    } = {
      credentialId,
      status: verify.ok ? ("active" as const) : ("invalid" as const),
    };
    if (verify.ok) {
      statusArgs.lastVerifiedAt = Date.now();
    } else {
      statusArgs.lastVerifyError = verify.message;
    }
    await ctx.runMutation(internal.media.credentialsDb._setStatus, statusArgs);

    const result: {
      credentialId: Id<"mediaCredentials">;
      ok: boolean;
      code?: string;
      message?: string;
    } = { credentialId, ok: verify.ok };
    if (!verify.ok) {
      result.code = verify.code;
      result.message = verify.message;
    }
    return result;
  },
});

export const testCredentials = action({
  args: {
    projectId: v.optional(v.id("projects")),
    provider: PROVIDER_VALIDATOR,
  },
  handler: async (
    ctx,
    args,
  ): Promise<{ ok: boolean; code?: string; message?: string }> => {
    const key = await getRateLimitKey(ctx);
    await rateLimiter.limit(ctx, "mediaCredentials:test", {
      key,
      throws: true,
    });

    const cred = await loadOwnedCredential(ctx, args.projectId, args.provider);
    await rateLimiter.limit(ctx, "vault:read", { key, throws: true });
    const secret: string = await ctx.runAction(
      internal.integrations.secretStore._read,
      {
        id: cred.vaultSecretId,
      },
    );

    const verify = await runProviderPing(args.provider, secret);
    const patch: {
      credentialId: Id<"mediaCredentials">;
      status: "active" | "invalid";
      lastVerifyError?: string;
      lastVerifiedAt?: number;
    } = {
      credentialId: cred._id,
      status: verify.ok ? "active" : "invalid",
    };
    if (verify.ok) patch.lastVerifiedAt = Date.now();
    else patch.lastVerifyError = verify.message;
    await ctx.runMutation(internal.media.credentialsDb._setStatus, patch);
    return verify;
  },
});

export const rotate = action({
  args: {
    projectId: v.optional(v.id("projects")),
    provider: PROVIDER_VALIDATOR,
    secret: v.string(),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{ workflowId: string; credentialId: Id<"mediaCredentials"> }> => {
    const key = await getRateLimitKey(ctx);
    await rateLimiter.limit(ctx, "mediaCredentials:rotate", {
      key,
      throws: true,
    });
    await rateLimiter.limit(ctx, "vault:write", { key, throws: true });

    const cred = await loadOwnedCredential(ctx, args.projectId, args.provider);

    const secret = await mergeWithStoredSecret(
      ctx,
      args.provider,
      args.secret,
      cred.vaultSecretId,
      key,
    );
    assertValidSecretShape(args.provider, secret);

    const priorStatus: "active" | "invalid" =
      cred.status === "invalid" ? "invalid" : "active";

    const created = await ctx.runAction(
      internal.integrations.secretStore._create,
      {
        value: secret,
        meta: {
          userId: cred.userId,
          provider: args.provider,
          label: `${args.provider}-creds-rotated`,
          ...(args.projectId !== undefined
            ? { projectId: args.projectId }
            : {}),
        },
      },
    );

    await ctx.runMutation(internal.media.credentialsDb._setStatus, {
      credentialId: cred._id,
      status: "rotating" as const,
    });

    const kickArgs: {
      credentialId: Id<"mediaCredentials">;
      provider: ProviderName;
      newVaultSecretId: string;
      newVersionId?: string;
      priorStatus: "active" | "invalid";
    } = {
      credentialId: cred._id,
      provider: args.provider,
      newVaultSecretId: created.id,
      priorStatus,
    };
    if (created.versionId !== undefined) {
      kickArgs.newVersionId = created.versionId;
    }
    let workflowId: string;
    try {
      workflowId = await ctx.runMutation(
        internal.workflows.rotateCredential.kickRotation,
        kickArgs,
      );
    } catch (err) {
      await ctx.runMutation(internal.media.credentialsDb._setStatus, {
        credentialId: cred._id,
        status: priorStatus,
      });
      await ctx.runAction(internal.integrations.secretStore._delete, {
        id: created.id,
      });
      throw err;
    }

    return { workflowId, credentialId: cred._id };
  },
});

export const deleteCredentials = action({
  args: {
    projectId: v.optional(v.id("projects")),
    provider: PROVIDER_VALIDATOR,
  },
  handler: async (ctx, args): Promise<void> => {
    const key = await getRateLimitKey(ctx);
    await rateLimiter.limit(ctx, "mediaCredentials:delete", {
      key,
      throws: true,
    });

    const { scope, project } = await requireScope(ctx, args.projectId);
    const cred = await requireScopedCredential(ctx, scope, args.provider);
    const inUse = project
      ? project.mediaStorageMode === args.provider
      : await ctx.runQuery(internal.media.credentialsDb._usedByNotes, {
          userId: scope.userId,
          provider: args.provider,
        });
    if (inUse) {
      throw new ConvexError({
        code: "UNKNOWN" as const,
        message: project
          ? "Switch media storage to a different provider before removing these credentials."
          : "Pick a different image source for notes before removing these credentials.",
      });
    }

    try {
      await ctx.runAction(internal.integrations.secretStore._delete, {
        id: cred.vaultSecretId,
      });
    } catch (err) {
      console.warn(
        `[media] failed to delete vault secret ${cred.vaultSecretId} for ${args.provider}:`,
        (err as { message?: string })?.message ?? err,
      );
    }
    await ctx.runMutation(internal.media.credentialsDb._delete, {
      credentialId: cred._id,
    });
  },
});

async function requireScope(
  ctx: ActionCtx,
  projectId: Id<"projects"> | undefined,
): Promise<{ scope: CredentialScope; project: Doc<"projects"> | null }> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error("Not authenticated");
  const user = await ctx.runQuery(internal.account.users.internalGetByToken, {
    tokenIdentifier: identity.tokenIdentifier,
  });
  if (!user) throw new Error("User not found");
  if (projectId === undefined) {
    return { scope: { userId: user._id, projectId: undefined }, project: null };
  }
  const project = await ctx.runQuery(internal.cms.projects.internalGet, {
    projectId,
  });
  if (!project || project.userId !== user._id) {
    throw new Error("Unauthorized");
  }
  return { scope: { userId: user._id, projectId }, project };
}

function scopeProject(scope: CredentialScope): { projectId?: Id<"projects"> } {
  return scope.projectId !== undefined ? { projectId: scope.projectId } : {};
}

async function findScopedCredential(
  ctx: ActionCtx,
  scope: CredentialScope,
  provider: ProviderName,
): Promise<Doc<"mediaCredentials"> | null> {
  return await ctx.runQuery(internal.media.credentialsDb._findByScope, {
    userId: scope.userId,
    provider,
    ...scopeProject(scope),
  });
}

async function requireScopedCredential(
  ctx: ActionCtx,
  scope: CredentialScope,
  provider: ProviderName,
): Promise<Doc<"mediaCredentials">> {
  const cred = await findScopedCredential(ctx, scope, provider);
  if (!cred) {
    throw new ConvexError({
      code: "AUTH_INVALID" as const,
      message: "No credentials configured for this provider.",
    });
  }
  return cred;
}

async function loadOwnedCredential(
  ctx: ActionCtx,
  projectId: Id<"projects"> | undefined,
  provider: ProviderName,
): Promise<Doc<"mediaCredentials">> {
  const { scope } = await requireScope(ctx, projectId);
  return await requireScopedCredential(ctx, scope, provider);
}

function assertValidSecretShape(provider: ProviderName, secret: string): void {
  try {
    getAdapter(provider).validateSecret(secret);
  } catch (e) {
    throw new ConvexError({
      code: "UNKNOWN" as const,
      message:
        (e as Error)?.message ??
        `${getMediaProvider(provider).label} credentials are malformed.`,
    });
  }
}

async function runProviderPing(
  provider: ProviderName,
  secret: string,
): Promise<{ ok: true } | { ok: false; code: string; message: string }> {
  const adapter = getAdapter(provider);
  try {
    await adapter.ping(secret);
    return { ok: true };
  } catch (err) {
    const data =
      err instanceof ConvexError
        ? (err.data as { code?: string; message?: string })
        : null;
    return {
      ok: false,
      code: data?.code ?? adapter.mapError(err),
      message:
        data?.message ??
        (err as { message?: string })?.message ??
        "Provider ping failed",
    };
  }
}
