"use node";

import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenAI } from "@google/genai";
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
      } catch {}
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

    const priorStatus: "active" | "invalid" =
      cred.status === "invalid" ? "invalid" : "active";

    await ctx.runMutation(internal.ai.credentialsDb._setStatus, {
      credentialId: cred._id,
      status: "rotating" as const,
    });

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
    } catch {}

    return { credentialId: cred._id, ok: true };
  },
});

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
    } catch {}
    await ctx.runMutation(internal.ai.credentialsDb._delete, {
      credentialId: cred._id,
    });
  },
});

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

async function runProviderPing(
  provider: AiProvider,
  apiKey: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    const entry = getProvider(provider);
    if (entry.kind === "anthropic-native") {
      const client = new Anthropic({ apiKey });
      await client.models.list({ limit: 1 });
    } else if (entry.kind === "gemini-native") {
      const ai = new GoogleGenAI({ apiKey });
      await ai.models.list({ config: { pageSize: 1 } });
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
