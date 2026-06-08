/**
 * aiCredentials — per-project AI provider key management.
 *
 * Mirrors the public surface of `media/credentials`:
 *   - `setCredentials` (first-time save + verify)
 *   - `rotate` (replace the key; verifies before swapping)
 *   - `testCredentials` (re-verify the stored key)
 *   - `deleteCredentials` (remove vault entry + row)
 *
 * All non-action helpers live in `credentialsDb.ts` (Convex can't put a
 * mutation inside a `"use node"` file).
 *
 * Verification = a cheap `models.list()` call against each provider. That
 * call doesn't consume any tokens, so users aren't charged just for saving
 * a key.
 */
"use node";

import Anthropic from "@anthropic-ai/sdk";
import { ConvexError, v } from "convex/values";
import OpenAI from "openai";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import type { ActionCtx } from "../_generated/server";
import { action } from "../_generated/server";
import { getRateLimitKey, rateLimiter } from "../_lib/rateLimits";
import {
  type AiProvider,
  getProvider,
  providerValidator,
} from "./_lib/providers";

/* ------------------------------------------------------------------ */
/*  Public actions                                                      */
/* ------------------------------------------------------------------ */

/**
 * First-time AI credential set. Stores the API key in the vault and runs
 * a verification ping. On invalid keys the row still gets written with
 * `status: "invalid"` so the UI can render the error.
 */
export const setCredentials = action({
  args: {
    projectId: v.id("projects"),
    provider: providerValidator,
    secret: v.string(),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{
    credentialId: Id<"aiCredentials">;
    ok: boolean;
    message?: string;
  }> => {
    const key = await getRateLimitKey(ctx);
    await rateLimiter.limit(ctx, "aiCredentials:set", { key, throws: true });
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

    const secret = args.secret.trim();
    if (!secret) {
      throw new ConvexError({
        message: "API key is required.",
      });
    }

    const existing = await ctx.runQuery(
      internal.ai.credentialsDb._findByProjectAndProvider,
      { projectId: args.projectId, provider: args.provider },
    );

    // Verify-first. When we're replacing an existing credential, we must
    // not destroy the working vault entry just because the user mistyped
    // a new key — leave the old row intact and surface the error instead.
    const verify = await runProviderPing(args.provider, secret);
    if (existing && !verify.ok) {
      return {
        credentialId: existing._id,
        ok: false,
        message: verify.message,
      };
    }

    const created = await ctx.runAction(
      internal.integrations.secretStore._create,
      {
        value: secret,
        meta: {
          userId: user._id,
          projectId: args.projectId,
          provider: args.provider,
          label: `${args.provider}-ai-key`,
        },
      },
    );

    let credentialId: Id<"aiCredentials">;
    if (existing) {
      credentialId = existing._id;
      const replaceArgs: {
        credentialId: Id<"aiCredentials">;
        newVaultSecretId: string;
        newVersionId?: string;
      } = {
        credentialId,
        newVaultSecretId: created.id,
      };
      if (created.versionId !== undefined) {
        replaceArgs.newVersionId = created.versionId;
      }
      await ctx.runMutation(
        internal.ai.credentialsDb._replaceVaultId,
        replaceArgs,
      );
      try {
        await ctx.runAction(internal.integrations.secretStore._delete, {
          id: existing.vaultSecretId,
        });
      } catch {
        // Orphan vault entries can be cleaned up out-of-band.
      }
    } else {
      const insertArgs: {
        projectId: Id<"projects">;
        userId: Id<"users">;
        provider: AiProvider;
        vaultSecretId: string;
        vaultVersionId?: string;
      } = {
        projectId: args.projectId,
        userId: user._id,
        provider: args.provider,
        vaultSecretId: created.id,
      };
      if (created.versionId !== undefined) {
        insertArgs.vaultVersionId = created.versionId;
      }
      credentialId = await ctx.runMutation(
        internal.ai.credentialsDb._insert,
        insertArgs,
      );
    }

    const statusArgs: {
      credentialId: Id<"aiCredentials">;
      status: "active" | "invalid";
      lastVerifyError?: string;
      lastVerifiedAt?: number;
    } = {
      credentialId,
      status: verify.ok ? "active" : "invalid",
    };
    if (verify.ok) statusArgs.lastVerifiedAt = Date.now();
    else statusArgs.lastVerifyError = verify.message;
    await ctx.runMutation(internal.ai.credentialsDb._setStatus, statusArgs);

    const result: {
      credentialId: Id<"aiCredentials">;
      ok: boolean;
      message?: string;
    } = { credentialId, ok: verify.ok };
    if (!verify.ok) result.message = verify.message;
    return result;
  },
});

/** Re-verify the stored key with a cheap `models.list()` ping. */
export const testCredentials = action({
  args: {
    projectId: v.id("projects"),
    provider: providerValidator,
  },
  handler: async (ctx, args): Promise<{ ok: boolean; message?: string }> => {
    const key = await getRateLimitKey(ctx);
    await rateLimiter.limit(ctx, "aiCredentials:test", { key, throws: true });

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
      credentialId: Id<"aiCredentials">;
      status: "active" | "invalid";
      lastVerifyError?: string;
      lastVerifiedAt?: number;
    } = {
      credentialId: cred._id,
      status: verify.ok ? "active" : "invalid",
    };
    if (verify.ok) patch.lastVerifiedAt = Date.now();
    else patch.lastVerifyError = verify.message;
    await ctx.runMutation(internal.ai.credentialsDb._setStatus, patch);
    return verify;
  },
});

/**
 * Replace the stored key. Verify-then-swap-then-delete-old: if verification
 * of the new key fails we keep the old vault entry in place and report the
 * error, so the user never ends up with no working key.
 */
export const rotate = action({
  args: {
    projectId: v.id("projects"),
    provider: providerValidator,
    secret: v.string(),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{
    credentialId: Id<"aiCredentials">;
    ok: boolean;
    message?: string;
  }> => {
    const key = await getRateLimitKey(ctx);
    await rateLimiter.limit(ctx, "aiCredentials:rotate", {
      key,
      throws: true,
    });
    await rateLimiter.limit(ctx, "vault:write", { key, throws: true });

    const cred = await loadOwnedCredential(ctx, args.projectId, args.provider);
    const newSecret = args.secret.trim();
    if (!newSecret) {
      throw new ConvexError({ message: "API key is required." });
    }

    // Snapshot the prior status so a failed rotation can revert correctly.
    // Previously we always reverted to "active", which incorrectly promoted
    // rows whose stored key was already known-bad ("invalid").
    const priorStatus: "active" | "invalid" =
      cred.status === "invalid" ? "invalid" : "active";

    // Mark as rotating up front so the UI can react.
    await ctx.runMutation(internal.ai.credentialsDb._setStatus, {
      credentialId: cred._id,
      status: "rotating" as const,
    });

    // Verify before storing — bail early if the new key is junk.
    const verify = await runProviderPing(args.provider, newSecret);
    if (!verify.ok) {
      await ctx.runMutation(internal.ai.credentialsDb._setStatus, {
        credentialId: cred._id,
        status: priorStatus,
        lastVerifyError: verify.message,
      });
      return { credentialId: cred._id, ok: false, message: verify.message };
    }

    let created: { id: string; versionId?: string };
    try {
      created = await ctx.runAction(internal.integrations.secretStore._create, {
        value: newSecret,
        meta: {
          userId: cred.userId,
          projectId: args.projectId,
          provider: args.provider,
          label: `${args.provider}-ai-key-rotated`,
        },
      });
    } catch (err) {
      await ctx.runMutation(internal.ai.credentialsDb._setStatus, {
        credentialId: cred._id,
        status: priorStatus,
      });
      throw err;
    }
    const markArgs: {
      credentialId: Id<"aiCredentials">;
      newVaultSecretId: string;
      newVersionId?: string;
    } = {
      credentialId: cred._id,
      newVaultSecretId: created.id,
    };
    if (created.versionId !== undefined) {
      markArgs.newVersionId = created.versionId;
    }
    await ctx.runMutation(internal.ai.credentialsDb._markRotated, markArgs);

    try {
      await ctx.runAction(internal.integrations.secretStore._delete, {
        id: cred.vaultSecretId,
      });
    } catch {
      // Orphan — non-fatal.
    }

    return { credentialId: cred._id, ok: true };
  },
});

/**
 * Delete the credential. Refuses if the project's active `aiProvider`
 * still points to this provider — user must switch first to avoid leaving
 * the AI in a non-functional state.
 */
export const deleteCredentials = action({
  args: {
    projectId: v.id("projects"),
    provider: providerValidator,
  },
  handler: async (ctx, args): Promise<void> => {
    const key = await getRateLimitKey(ctx);
    await rateLimiter.limit(ctx, "aiCredentials:delete", {
      key,
      throws: true,
    });

    const cred = await loadOwnedCredential(ctx, args.projectId, args.provider);
    const project = await ctx.runQuery(internal.cms.projects.internalGet, {
      projectId: args.projectId,
    });
    if (project?.aiProvider === args.provider) {
      throw new ConvexError({
        message:
          "Switch AI provider to a different one before removing these credentials.",
      });
    }

    try {
      await ctx.runAction(internal.integrations.secretStore._delete, {
        id: cred.vaultSecretId,
      });
    } catch {
      // Best-effort.
    }
    await ctx.runMutation(internal.ai.credentialsDb._delete, {
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
  provider: AiProvider,
): Promise<{
  _id: Id<"aiCredentials">;
  vaultSecretId: string;
  userId: Id<"users">;
  status: "active" | "invalid" | "verifying" | "rotating";
}> {
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
    internal.ai.credentialsDb._findByProjectAndProvider,
    { projectId, provider },
  );
  if (!cred) {
    throw new ConvexError({
      message: "No credentials configured for this provider.",
    });
  }
  return {
    _id: cred._id,
    vaultSecretId: cred.vaultSecretId,
    userId: cred.userId,
    status: cred.status,
  };
}

/**
 * Provider verification. All three SDKs expose `models.list()` which is a
 * cheap HTTP call that doesn't consume any tokens — perfect for verifying
 * a key without charging the user.
 */
async function runProviderPing(
  provider: AiProvider,
  apiKey: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    const entry = getProvider(provider);
    if (entry.kind === "anthropic-native") {
      const client = new Anthropic({ apiKey });
      await client.models.list({ limit: 1 });
    } else {
      const client = new OpenAI({
        apiKey,
        ...(entry.baseURL ? { baseURL: entry.baseURL } : {}),
        ...(entry.extraHeaders ? { defaultHeaders: entry.extraHeaders } : {}),
      });
      await client.models.list();
    }
    return { ok: true };
  } catch (err) {
    const status = (err as { status?: number })?.status;
    const raw = (err as { message?: string })?.message ?? "Ping failed.";
    let message = raw;
    if (status === 401) {
      message = "The API key was rejected as invalid. Double-check it.";
    } else if (status === 403) {
      message =
        "The API key is valid but doesn't have access to this provider's API.";
    } else if (status === 429) {
      message =
        "Your provider is rate-limiting the verification call. Try again in a moment.";
    } else if (status !== undefined && status >= 500) {
      message =
        "The provider is returning a 5xx error — try the verification again later.";
    }
    return { ok: false, message };
  }
}
