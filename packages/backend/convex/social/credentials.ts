/**
 * socialCredentials — per-project Buffer API key management.
 *
 * Mirrors `ai/credentials.ts`:
 *   - `setCredentials` (first-time save + verify)
 *   - `rotate` (replace the key; verifies before swapping)
 *   - `testCredentials` (re-verify the stored key + refresh channel list)
 *   - `deleteCredentials` (remove vault entry + row; also clears the legacy
 *     Upload-Post row when asked)
 *   - `updateConfig` (change which channels announcements go to)
 *
 * Verification = listing the account's channels via Buffer's GraphQL API —
 * a key that can't list channels can't post. The channel list is cached in
 * `publicConfig` so the settings UI renders it without a live round-trip:
 * `{ channels: [{id, service, name}], enabledChannelIds: string[] }`.
 */
"use node";

import { ConvexError, v } from "convex/values";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import type { ActionCtx } from "../_generated/server";
import { action } from "../_generated/server";
import { getRateLimitKey, rateLimiter } from "../_lib/rateLimits";
import { type BufferChannel, fetchBufferChannels } from "./buffer";

export type BufferPublicConfig = {
  channels: BufferChannel[];
  enabledChannelIds: string[];
};

function buildPublicConfig(
  channels: BufferChannel[],
  enabledChannelIds: string[],
): string {
  const valid = new Set(channels.map((c) => c.id));
  return JSON.stringify({
    channels,
    enabledChannelIds: enabledChannelIds.filter((id) => valid.has(id)),
  } satisfies BufferPublicConfig);
}

/* ------------------------------------------------------------------ */
/*  Public actions                                                      */
/* ------------------------------------------------------------------ */

export const setCredentials = action({
  args: {
    projectId: v.id("projects"),
    secret: v.string(),
    /** Channel ids to announce to; empty = enable all connected channels. */
    enabledChannelIds: v.optional(v.array(v.string())),
  },
  returns: v.object({
    credentialId: v.union(v.id("socialCredentials"), v.null()),
    ok: v.boolean(),
    message: v.optional(v.string()),
    channels: v.optional(
      v.array(
        v.object({ id: v.string(), service: v.string(), name: v.string() }),
      ),
    ),
  }),
  handler: async (
    ctx,
    args,
  ): Promise<{
    credentialId: Id<"socialCredentials"> | null;
    ok: boolean;
    message?: string;
    channels?: BufferChannel[];
  }> => {
    const key = await getRateLimitKey(ctx);
    await rateLimiter.limit(ctx, "socialCredentials:set", {
      key,
      throws: true,
    });
    await rateLimiter.limit(ctx, "vault:write", { key, throws: true });

    const { user } = await loadOwnerContext(ctx, args.projectId);

    const secret = args.secret.trim();
    if (!secret) throw new ConvexError({ message: "API key is required." });
    if (secret.length > 512)
      throw new ConvexError({ message: "API key is too long." });

    const existing = await ctx.runQuery(
      internal.social.credentialsDb._findByProject,
      { projectId: args.projectId, provider: "buffer" },
    );

    // Verify-first — never destroy a working vault entry on a bad new secret,
    // and the channel list doubles as the config we store.
    const verify = await fetchBufferChannels(secret);
    if (!verify.ok) {
      return {
        credentialId: existing?._id ?? null,
        ok: false,
        message: verify.message,
      };
    }
    if (verify.channels.length === 0) {
      return {
        credentialId: existing?._id ?? null,
        ok: false,
        message:
          "The key works, but no channels are connected in Buffer. Connect your social accounts at buffer.com first.",
      };
    }

    const enabled =
      args.enabledChannelIds && args.enabledChannelIds.length > 0
        ? args.enabledChannelIds
        : verify.channels.map((c) => c.id);
    const publicConfig = buildPublicConfig(verify.channels, enabled);

    const created = await ctx.runAction(
      internal.integrations.secretStore._create,
      {
        value: secret,
        meta: {
          userId: user._id,
          projectId: args.projectId,
          provider: "buffer",
          label: "buffer-social-key",
        },
      },
    );

    let credentialId: Id<"socialCredentials">;
    if (existing) {
      credentialId = existing._id;
      const replaceArgs: {
        credentialId: Id<"socialCredentials">;
        newVaultSecretId: string;
        newVersionId?: string;
      } = { credentialId, newVaultSecretId: created.id };
      if (created.versionId !== undefined)
        replaceArgs.newVersionId = created.versionId;
      await ctx.runMutation(
        internal.social.credentialsDb._replaceVaultId,
        replaceArgs,
      );
      await ctx.runMutation(internal.social.credentialsDb._updatePublicConfig, {
        credentialId,
        publicConfig,
      });
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
        provider: "buffer";
        vaultSecretId: string;
        vaultVersionId?: string;
        publicConfig: string;
      } = {
        projectId: args.projectId,
        userId: user._id,
        provider: "buffer",
        vaultSecretId: created.id,
        publicConfig,
      };
      if (created.versionId !== undefined)
        insertArgs.vaultVersionId = created.versionId;
      credentialId = await ctx.runMutation(
        internal.social.credentialsDb._insert,
        insertArgs,
      );
    }

    await ctx.runMutation(internal.social.credentialsDb._setStatus, {
      credentialId,
      status: "active",
      lastVerifiedAt: Date.now(),
    });

    return { credentialId, ok: true, channels: verify.channels };
  },
});

/**
 * Re-verify the stored key. Also refreshes the cached channel list, so
 * "Test Connection" doubles as "pick up newly connected Buffer channels".
 */
export const testCredentials = action({
  args: { projectId: v.id("projects") },
  returns: v.object({ ok: v.boolean(), message: v.optional(v.string()) }),
  handler: async (ctx, args): Promise<{ ok: boolean; message?: string }> => {
    const key = await getRateLimitKey(ctx);
    await rateLimiter.limit(ctx, "socialCredentials:test", {
      key,
      throws: true,
    });

    const cred = await loadOwnedCredential(ctx, args.projectId);
    await rateLimiter.limit(ctx, "vault:read", { key, throws: true });
    const secret: string = await ctx.runAction(
      internal.integrations.secretStore._read,
      { id: cred.vaultSecretId },
    );

    const verify = await fetchBufferChannels(secret);
    if (!verify.ok) {
      await ctx.runMutation(internal.social.credentialsDb._setStatus, {
        credentialId: cred._id,
        status: "invalid",
        lastVerifyError: verify.message,
      });
      return verify;
    }

    // Keep prior enabled selection where those channels still exist; newly
    // connected channels stay unselected until the user opts in.
    const prior = parseConfig(cred.publicConfig);
    await ctx.runMutation(internal.social.credentialsDb._updatePublicConfig, {
      credentialId: cred._id,
      publicConfig: buildPublicConfig(
        verify.channels,
        prior?.enabledChannelIds ?? verify.channels.map((c) => c.id),
      ),
    });
    await ctx.runMutation(internal.social.credentialsDb._setStatus, {
      credentialId: cred._id,
      status: "active",
      lastVerifiedAt: Date.now(),
    });
    return { ok: true };
  },
});

export const rotate = action({
  args: {
    projectId: v.id("projects"),
    secret: v.string(),
  },
  returns: v.object({
    credentialId: v.id("socialCredentials"),
    ok: v.boolean(),
    message: v.optional(v.string()),
  }),
  handler: async (
    ctx,
    args,
  ): Promise<{
    credentialId: Id<"socialCredentials">;
    ok: boolean;
    message?: string;
  }> => {
    const key = await getRateLimitKey(ctx);
    await rateLimiter.limit(ctx, "socialCredentials:rotate", {
      key,
      throws: true,
    });
    await rateLimiter.limit(ctx, "vault:write", { key, throws: true });

    const cred = await loadOwnedCredential(ctx, args.projectId);
    const newSecret = args.secret.trim();
    if (!newSecret) throw new ConvexError({ message: "API key is required." });

    const priorStatus: "active" | "invalid" =
      cred.status === "invalid" ? "invalid" : "active";

    await ctx.runMutation(internal.social.credentialsDb._setStatus, {
      credentialId: cred._id,
      status: "rotating" as const,
    });

    const verify = await fetchBufferChannels(newSecret);
    if (!verify.ok) {
      await ctx.runMutation(internal.social.credentialsDb._setStatus, {
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
          provider: "buffer",
          label: "buffer-social-key-rotated",
        },
      });
    } catch (err) {
      await ctx.runMutation(internal.social.credentialsDb._setStatus, {
        credentialId: cred._id,
        status: priorStatus,
      });
      throw err;
    }

    const markArgs: {
      credentialId: Id<"socialCredentials">;
      newVaultSecretId: string;
      newVersionId?: string;
    } = { credentialId: cred._id, newVaultSecretId: created.id };
    if (created.versionId !== undefined)
      markArgs.newVersionId = created.versionId;
    await ctx.runMutation(internal.social.credentialsDb._markRotated, markArgs);

    // Refresh the channel cache from the new key's account.
    const prior = parseConfig(cred.publicConfig);
    await ctx.runMutation(internal.social.credentialsDb._updatePublicConfig, {
      credentialId: cred._id,
      publicConfig: buildPublicConfig(
        verify.channels,
        prior?.enabledChannelIds ?? verify.channels.map((c) => c.id),
      ),
    });

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

export const deleteCredentials = action({
  args: {
    projectId: v.id("projects"),
    /** Also used to clear the retired Upload-Post row from the migration banner. */
    provider: v.optional(
      v.union(v.literal("buffer"), v.literal("upload-post")),
    ),
  },
  returns: v.null(),
  handler: async (ctx, args): Promise<null> => {
    const key = await getRateLimitKey(ctx);
    await rateLimiter.limit(ctx, "socialCredentials:delete", {
      key,
      throws: true,
    });

    await loadOwnerContext(ctx, args.projectId);
    const cred = await ctx.runQuery(
      internal.social.credentialsDb._findByProject,
      { projectId: args.projectId, provider: args.provider ?? "buffer" },
    );
    if (!cred) return null;

    try {
      await ctx.runAction(internal.integrations.secretStore._delete, {
        id: cred.vaultSecretId,
      });
    } catch {
      // Best-effort.
    }
    await ctx.runMutation(internal.social.credentialsDb._delete, {
      credentialId: cred._id,
    });
    return null;
  },
});

/** Change which connected channels announcements are sent to. */
export const updateConfig = action({
  args: {
    projectId: v.id("projects"),
    enabledChannelIds: v.array(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args): Promise<null> => {
    const key = await getRateLimitKey(ctx);
    await rateLimiter.limit(ctx, "socialCredentials:updateConfig", {
      key,
      throws: true,
    });

    const cred = await loadOwnedCredential(ctx, args.projectId);
    const existing = parseConfig(cred.publicConfig);
    if (!existing) {
      throw new ConvexError({
        message: "No channel list cached — run Test Connection first.",
      });
    }
    if (args.enabledChannelIds.length === 0) {
      throw new ConvexError({ message: "Select at least one channel." });
    }

    await ctx.runMutation(internal.social.credentialsDb._updatePublicConfig, {
      credentialId: cred._id,
      publicConfig: buildPublicConfig(
        existing.channels,
        args.enabledChannelIds,
      ),
    });
    return null;
  },
});

/* ------------------------------------------------------------------ */
/*  Helpers                                                             */
/* ------------------------------------------------------------------ */

export function parseConfig(
  raw: string | undefined,
): BufferPublicConfig | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<BufferPublicConfig>;
    if (!Array.isArray(parsed.channels)) return null;
    return {
      channels: parsed.channels,
      enabledChannelIds: Array.isArray(parsed.enabledChannelIds)
        ? parsed.enabledChannelIds
        : [],
    };
  } catch {
    return null;
  }
}

async function loadOwnerContext(
  ctx: ActionCtx,
  projectId: Id<"projects">,
): Promise<{ user: { _id: Id<"users"> }; project: { _id: Id<"projects"> } }> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error("Not authenticated");
  const user = await ctx.runQuery(internal.account.users.internalGetByToken, {
    tokenIdentifier: identity.tokenIdentifier,
  });
  if (!user) throw new Error("User not found");
  const project = await ctx.runQuery(internal.cms.projects.internalGet, {
    projectId,
  });
  if (!project || project.userId !== user._id) throw new Error("Unauthorized");
  return { user, project };
}

async function loadOwnedCredential(
  ctx: ActionCtx,
  projectId: Id<"projects">,
): Promise<{
  _id: Id<"socialCredentials">;
  vaultSecretId: string;
  userId: Id<"users">;
  status: "active" | "invalid" | "verifying" | "rotating";
  publicConfig?: string;
}> {
  await loadOwnerContext(ctx, projectId);
  const cred = await ctx.runQuery(
    internal.social.credentialsDb._findByProject,
    { projectId, provider: "buffer" },
  );
  if (!cred) {
    throw new ConvexError({
      message: "No Buffer credentials configured.",
    });
  }
  const result: {
    _id: Id<"socialCredentials">;
    vaultSecretId: string;
    userId: Id<"users">;
    status: "active" | "invalid" | "verifying" | "rotating";
    publicConfig?: string;
  } = {
    _id: cred._id,
    vaultSecretId: cred.vaultSecretId,
    userId: cred.userId,
    status: cred.status,
  };
  if (cred.publicConfig !== undefined) result.publicConfig = cred.publicConfig;
  return result;
}
