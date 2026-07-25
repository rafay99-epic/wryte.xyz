/**
 * syndicationCredentials — per-project dev.to / Hashnode token management.
 *
 * Mirrors `social/credentials.ts`:
 *   - `setCredentials` handles first save AND rotation (verify-first — a bad
 *     new token never destroys a working vault entry)
 *   - `testCredentials` re-verifies + refreshes the cached account info
 *   - `updateConfig` flips the per-provider `enabled` switch / Hashnode
 *     publication choice — connecting alone never activates posting
 *   - `deleteCredentials` removes the vault entry + row
 *
 * Verification: dev.to `GET /users/me`; Hashnode `me { publications }` —
 * which also discriminates "bad token" from "publication needs Pro" (the
 * Hashnode API is paid since 2026-05; see hashnode.ts).
 */
"use node";

import { ConvexError, v } from "convex/values";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import type { ActionCtx } from "../_generated/server";
import { action } from "../_generated/server";
import { getRateLimitKey, rateLimiter } from "../_lib/rateLimits";
import {
  parseSyndicationConfig,
  type SyndicationProvider,
  type SyndicationPublicConfig,
  syndicationProviderValidator,
} from "./_lib/providers";
import { verifyDevtoKey } from "./devto";
import { fetchHashnodePublications } from "./hashnode";

type VerifyOutcome =
  | { ok: true; config: Omit<SyndicationPublicConfig, "enabled"> }
  | { ok: false; message: string };

/** Provider-specific token probe; returns the non-secret config to cache. */
async function verifySecret(
  provider: SyndicationProvider,
  secret: string,
  prior: SyndicationPublicConfig,
): Promise<VerifyOutcome> {
  if (provider === "devto") {
    const result = await verifyDevtoKey(secret);
    if (!result.ok) return { ok: false, message: result.message };
    return { ok: true, config: { username: result.data.username } };
  }
  const result = await fetchHashnodePublications(secret);
  if (!result.ok) return { ok: false, message: result.message };
  if (result.data.publications.length === 0) {
    return {
      ok: false,
      message:
        "The token works, but no publications exist on this Hashnode account — create one at hashnode.com first.",
    };
  }
  const stillValid = result.data.publications.some(
    (p) => p.id === prior.publicationId,
  );
  const publicationId = stillValid
    ? prior.publicationId
    : result.data.publications[0]?.id;
  return {
    ok: true,
    config: {
      username: result.data.username,
      publications: result.data.publications,
      ...(publicationId !== undefined ? { publicationId } : {}),
    },
  };
}

function serializeConfig(
  enabled: boolean,
  config: Omit<SyndicationPublicConfig, "enabled">,
): string {
  return JSON.stringify({
    enabled,
    ...config,
  } satisfies SyndicationPublicConfig);
}

/* ------------------------------------------------------------------ */
/*  Public actions                                                      */
/* ------------------------------------------------------------------ */

export const setCredentials = action({
  args: {
    projectId: v.id("projects"),
    provider: syndicationProviderValidator,
    secret: v.string(),
  },
  returns: v.object({ ok: v.boolean(), message: v.optional(v.string()) }),
  handler: async (ctx, args): Promise<{ ok: boolean; message?: string }> => {
    const key = await getRateLimitKey(ctx);
    await rateLimiter.limit(ctx, "syndicationCredentials:set", {
      key,
      throws: true,
    });
    await rateLimiter.limit(ctx, "vault:write", { key, throws: true });

    const { user } = await loadOwnerContext(ctx, args.projectId);

    const secret = args.secret.trim();
    if (!secret) throw new ConvexError({ message: "API token is required." });
    if (secret.length > 512)
      throw new ConvexError({ message: "API token is too long." });

    const existing = await ctx.runQuery(
      internal.syndication.credentialsDb._findByProject,
      { projectId: args.projectId, provider: args.provider },
    );
    const prior = parseSyndicationConfig(existing?.publicConfig);

    const verify = await verifySecret(args.provider, secret, prior);
    if (!verify.ok) return { ok: false, message: verify.message };

    // Posting stays off until the user flips the Active switch — a freshly
    // pasted token must never cause a surprise cross-post.
    const publicConfig = serializeConfig(prior.enabled, verify.config);

    const created = await ctx.runAction(
      internal.integrations.secretStore._create,
      {
        value: secret,
        meta: {
          userId: user._id,
          projectId: args.projectId,
          provider: args.provider,
          label: `${args.provider}-syndication-token`,
        },
      },
    );

    let credentialId: Id<"syndicationCredentials">;
    if (existing) {
      credentialId = existing._id;
      const replaceArgs: {
        credentialId: Id<"syndicationCredentials">;
        newVaultSecretId: string;
        newVersionId?: string;
      } = { credentialId, newVaultSecretId: created.id };
      if (created.versionId !== undefined)
        replaceArgs.newVersionId = created.versionId;
      await ctx.runMutation(
        internal.syndication.credentialsDb._replaceVaultId,
        replaceArgs,
      );
      await ctx.runMutation(
        internal.syndication.credentialsDb._updatePublicConfig,
        { credentialId, publicConfig },
      );
      try {
        await ctx.runAction(internal.integrations.secretStore._delete, {
          id: existing.vaultSecretId,
        });
      } catch {
        // Orphan vault entry — non-fatal.
      }
    } else {
      const insertArgs: {
        projectId: Id<"projects">;
        userId: Id<"users">;
        provider: SyndicationProvider;
        vaultSecretId: string;
        vaultVersionId?: string;
        publicConfig: string;
      } = {
        projectId: args.projectId,
        userId: user._id,
        provider: args.provider,
        vaultSecretId: created.id,
        publicConfig,
      };
      if (created.versionId !== undefined)
        insertArgs.vaultVersionId = created.versionId;
      credentialId = await ctx.runMutation(
        internal.syndication.credentialsDb._insert,
        insertArgs,
      );
    }

    await ctx.runMutation(internal.syndication.credentialsDb._setStatus, {
      credentialId,
      status: "active",
      lastVerifiedAt: Date.now(),
    });

    return { ok: true };
  },
});

/** Re-verify the stored token and refresh the cached account info. */
export const testCredentials = action({
  args: {
    projectId: v.id("projects"),
    provider: syndicationProviderValidator,
  },
  returns: v.object({ ok: v.boolean(), message: v.optional(v.string()) }),
  handler: async (ctx, args): Promise<{ ok: boolean; message?: string }> => {
    const key = await getRateLimitKey(ctx);
    await rateLimiter.limit(ctx, "syndicationCredentials:test", {
      key,
      throws: true,
    });

    const cred = await loadOwnedCredential(ctx, args.projectId, args.provider);
    await rateLimiter.limit(ctx, "vault:read", { key, throws: true });
    const secret: string = await ctx.runAction(
      internal.integrations.secretStore._read,
      { id: cred.vaultSecretId },
    );

    const prior = parseSyndicationConfig(cred.publicConfig);
    const verify = await verifySecret(args.provider, secret, prior);
    if (!verify.ok) {
      await ctx.runMutation(internal.syndication.credentialsDb._setStatus, {
        credentialId: cred._id,
        status: "invalid",
        lastVerifyError: verify.message,
      });
      return { ok: false, message: verify.message };
    }

    await ctx.runMutation(
      internal.syndication.credentialsDb._updatePublicConfig,
      {
        credentialId: cred._id,
        publicConfig: serializeConfig(prior.enabled, verify.config),
      },
    );
    await ctx.runMutation(internal.syndication.credentialsDb._setStatus, {
      credentialId: cred._id,
      status: "active",
      lastVerifiedAt: Date.now(),
    });
    return { ok: true };
  },
});

/**
 * Flip the per-provider Active switch or pick the Hashnode publication.
 * Non-secret settings only — no vault round-trip.
 */
export const updateConfig = action({
  args: {
    projectId: v.id("projects"),
    provider: syndicationProviderValidator,
    enabled: v.optional(v.boolean()),
    publicationId: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args): Promise<null> => {
    const key = await getRateLimitKey(ctx);
    await rateLimiter.limit(ctx, "syndicationCredentials:updateConfig", {
      key,
      throws: true,
    });

    const cred = await loadOwnedCredential(ctx, args.projectId, args.provider);
    const config = parseSyndicationConfig(cred.publicConfig);

    if (args.publicationId !== undefined) {
      const valid = config.publications?.some(
        (p) => p.id === args.publicationId,
      );
      if (!valid) {
        throw new ConvexError({
          message:
            "Unknown publication — run Test Connection to refresh the list.",
        });
      }
      config.publicationId = args.publicationId;
    }
    if (args.enabled !== undefined) config.enabled = args.enabled;

    await ctx.runMutation(
      internal.syndication.credentialsDb._updatePublicConfig,
      { credentialId: cred._id, publicConfig: JSON.stringify(config) },
    );
    return null;
  },
});

export const deleteCredentials = action({
  args: {
    projectId: v.id("projects"),
    provider: syndicationProviderValidator,
  },
  returns: v.null(),
  handler: async (ctx, args): Promise<null> => {
    const key = await getRateLimitKey(ctx);
    await rateLimiter.limit(ctx, "syndicationCredentials:delete", {
      key,
      throws: true,
    });

    await loadOwnerContext(ctx, args.projectId);
    const cred = await ctx.runQuery(
      internal.syndication.credentialsDb._findByProject,
      { projectId: args.projectId, provider: args.provider },
    );
    if (!cred) return null;

    try {
      await ctx.runAction(internal.integrations.secretStore._delete, {
        id: cred.vaultSecretId,
      });
    } catch {
      // Best-effort.
    }
    await ctx.runMutation(internal.syndication.credentialsDb._delete, {
      credentialId: cred._id,
    });
    return null;
  },
});

/* ------------------------------------------------------------------ */
/*  Helpers                                                             */
/* ------------------------------------------------------------------ */

export async function loadOwnerContext(
  ctx: ActionCtx,
  projectId: Id<"projects">,
): Promise<{ user: { _id: Id<"users"> } }> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new ConvexError({ message: "Not authenticated" });
  const user = await ctx.runQuery(internal.account.users.internalGetByToken, {
    tokenIdentifier: identity.tokenIdentifier,
  });
  if (!user) throw new ConvexError({ message: "User not found" });
  const project = await ctx.runQuery(internal.cms.projects.internalGet, {
    projectId,
  });
  if (!project || project.userId !== user._id)
    throw new ConvexError({ message: "Unauthorized" });
  return { user };
}

async function loadOwnedCredential(
  ctx: ActionCtx,
  projectId: Id<"projects">,
  provider: SyndicationProvider,
): Promise<{
  _id: Id<"syndicationCredentials">;
  vaultSecretId: string;
  publicConfig?: string;
}> {
  await loadOwnerContext(ctx, projectId);
  const cred = await ctx.runQuery(
    internal.syndication.credentialsDb._findByProject,
    { projectId, provider },
  );
  if (!cred) {
    throw new ConvexError({ message: "No credentials configured." });
  }
  return {
    _id: cred._id,
    vaultSecretId: cred.vaultSecretId,
    ...(cred.publicConfig !== undefined
      ? { publicConfig: cred.publicConfig }
      : {}),
  };
}
