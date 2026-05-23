/**
 * mediaCredentials — public actions for the settings UI.
 *
 * All non-action helpers (queries, internal mutations) live in
 * `credentialsDb.ts`; everything in this file runs in Convex's Node
 * runtime because the provider SDKs depend on Node-specific globals.
 *
 * The rotation flow is delegated to `workflows/rotateCredential.ts` so the
 * "verify new → swap pointer → delete old" sequence survives crashes.
 */
"use node";

import { ConvexError, v } from "convex/values";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import type { ActionCtx } from "../_generated/server";
import { action } from "../_generated/server";
import { getRateLimitKey, rateLimiter } from "../_lib/rateLimits";
import { cldPing, utPing } from "../providers";
import { mapCloudinaryError, mapUploadThingError } from "../providers/errors";
import { parseCloudinarySecret } from "../providers/shared";

const PROVIDER_VALIDATOR = v.union(
  v.literal("uploadthing"),
  v.literal("cloudinary"),
);

type ProviderName = "uploadthing" | "cloudinary";

/* ------------------------------------------------------------------ */
/*  Public actions                                                      */
/* ------------------------------------------------------------------ */

/**
 * First-time credential set. Stores the secret in the vault and runs a ping
 * to flip the row to `active` (or `invalid` with a friendly error).
 */
export const setCredentials = action({
  args: {
    projectId: v.id("projects"),
    provider: PROVIDER_VALIDATOR,
    secret: v.string(),
    publicConfig: v.optional(v.string()),
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

    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const user = await ctx.runQuery(internal.account.users.internalGetByToken, {
      tokenIdentifier: identity.tokenIdentifier,
    });
    if (!user) throw new Error("User not found");
    const project = await ctx.runQuery(internal.cms.projects.internalGet, {
      projectId: args.projectId,
    });
    if (!project || project.userId !== user._id) {
      throw new Error("Unauthorized");
    }

    // Validate Cloudinary shape early so we never persist a malformed secret.
    if (args.provider === "cloudinary") {
      try {
        parseCloudinarySecret(args.secret);
      } catch (e) {
        throw new ConvexError({
          code: "UNKNOWN" as const,
          message:
            (e as Error)?.message ??
            "Cloudinary credentials must be JSON with cloud_name, api_key, api_secret",
        });
      }
    }

    const existing = await ctx.runQuery(
      internal.media.credentialsDb._findByProjectAndProvider,
      { projectId: args.projectId, provider: args.provider },
    );

    // Verify-first when replacing an existing credential — never destroy
    // the working vault entry on a bad new secret.
    const verify = await runProviderPing(args.provider, args.secret);
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
        value: args.secret,
        meta: {
          userId: user._id,
          projectId: args.projectId,
          provider: args.provider,
          label: `${args.provider}-creds`,
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
        publicConfig?: string;
      } = {
        credentialId,
        newVaultSecretId: created.id,
      };
      if (created.versionId !== undefined) {
        replaceArgs.newVersionId = created.versionId;
      }
      if (args.publicConfig !== undefined) {
        replaceArgs.publicConfig = args.publicConfig;
      }
      await ctx.runMutation(
        internal.media.credentialsDb._replaceVaultId,
        replaceArgs,
      );
      // Best-effort delete of the prior vault entry. If this fails, the new
      // pointer is already in place so the user is unaffected.
      try {
        await ctx.runAction(internal.integrations.secretStore._delete, {
          id: existing.vaultSecretId,
        });
      } catch {
        // Ignore — orphan vault entries can be cleaned up out-of-band.
      }
    } else {
      const insertArgs: {
        projectId: Id<"projects">;
        userId: Id<"users">;
        provider: ProviderName;
        vaultSecretId: string;
        vaultVersionId?: string;
        publicConfig?: string;
      } = {
        projectId: args.projectId,
        userId: user._id,
        provider: args.provider,
        vaultSecretId: created.id,
      };
      if (created.versionId !== undefined) {
        insertArgs.vaultVersionId = created.versionId;
      }
      if (args.publicConfig !== undefined) {
        insertArgs.publicConfig = args.publicConfig;
      }
      credentialId = await ctx.runMutation(
        internal.media.credentialsDb._insert,
        insertArgs,
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

/**
 * Re-verify the active credential against the provider.
 */
export const testCredentials = action({
  args: {
    projectId: v.id("projects"),
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

/**
 * Begin a credential rotation. The actual sequencing (verify → swap → delete)
 * happens inside `rotateCredentialWorkflow` so a crash mid-rotation leaves
 * a recoverable state (either the old or the new secret, never both lost).
 */
export const rotate = action({
  args: {
    projectId: v.id("projects"),
    provider: PROVIDER_VALIDATOR,
    secret: v.string(),
    publicConfig: v.optional(v.string()),
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

    if (args.provider === "cloudinary") {
      try {
        parseCloudinarySecret(args.secret);
      } catch (e) {
        throw new ConvexError({
          code: "UNKNOWN" as const,
          message:
            (e as Error)?.message ??
            "Cloudinary credentials must be JSON with cloud_name, api_key, api_secret",
        });
      }
    }

    await ctx.runMutation(internal.media.credentialsDb._setStatus, {
      credentialId: cred._id,
      status: "rotating" as const,
    });

    const kickArgs: {
      credentialId: Id<"mediaCredentials">;
      provider: ProviderName;
      newSecret: string;
      publicConfig?: string;
    } = {
      credentialId: cred._id,
      provider: args.provider,
      newSecret: args.secret,
    };
    if (args.publicConfig !== undefined) {
      kickArgs.publicConfig = args.publicConfig;
    }
    const workflowId: string = await ctx.runMutation(
      internal.workflows.rotateCredential.kickRotation,
      kickArgs,
    );

    return { workflowId, credentialId: cred._id };
  },
});

/**
 * Delete a credential. Refuses if the project's `mediaStorageMode` still
 * points to this provider (user must switch first).
 */
export const deleteCredentials = action({
  args: {
    projectId: v.id("projects"),
    provider: PROVIDER_VALIDATOR,
  },
  handler: async (ctx, args): Promise<void> => {
    const key = await getRateLimitKey(ctx);
    await rateLimiter.limit(ctx, "mediaCredentials:delete", {
      key,
      throws: true,
    });

    const cred = await loadOwnedCredential(ctx, args.projectId, args.provider);
    const project = await ctx.runQuery(internal.cms.projects.internalGet, {
      projectId: args.projectId,
    });
    if (project?.mediaStorageMode === args.provider) {
      throw new ConvexError({
        code: "UNKNOWN" as const,
        message:
          "Switch media storage to a different provider before removing these credentials.",
      });
    }

    try {
      await ctx.runAction(internal.integrations.secretStore._delete, {
        id: cred.vaultSecretId,
      });
    } catch {
      // Vault entry may already be gone; row removal still proceeds.
    }
    await ctx.runMutation(internal.media.credentialsDb._delete, {
      credentialId: cred._id,
    });
  },
});

/* ------------------------------------------------------------------ */
/*  Helpers                                                              */
/* ------------------------------------------------------------------ */

async function loadOwnedCredential(
  ctx: ActionCtx,
  projectId: Id<"projects">,
  provider: ProviderName,
): Promise<{ _id: Id<"mediaCredentials">; vaultSecretId: string }> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error("Not authenticated");
  const user = await ctx.runQuery(internal.account.users.internalGetByToken, {
    tokenIdentifier: identity.tokenIdentifier,
  });
  if (!user) throw new Error("User not found");
  const project = await ctx.runQuery(internal.cms.projects.internalGet, {
    projectId,
  });
  if (!project || project.userId !== user._id) {
    throw new Error("Unauthorized");
  }
  const cred = await ctx.runQuery(
    internal.media.credentialsDb._findByProjectAndProvider,
    { projectId, provider },
  );
  if (!cred) {
    throw new ConvexError({
      code: "AUTH_INVALID" as const,
      message: "No credentials configured for this provider.",
    });
  }
  return { _id: cred._id, vaultSecretId: cred.vaultSecretId };
}

async function runProviderPing(
  provider: ProviderName,
  secret: string,
): Promise<{ ok: true } | { ok: false; code: string; message: string }> {
  try {
    if (provider === "uploadthing") {
      await utPing(secret);
    } else {
      await cldPing(secret);
    }
    return { ok: true };
  } catch (err) {
    const code =
      provider === "uploadthing"
        ? mapUploadThingError(err)
        : mapCloudinaryError(err);
    const message =
      (err as { message?: string })?.message ?? "Provider ping failed";
    return { ok: false, code, message };
  }
}
