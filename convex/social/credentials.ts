/**
 * socialCredentials — per-project Upload-Post key management.
 *
 * Mirrors `ai/credentials.ts`:
 *   - `setCredentials` (first-time save + verify)
 *   - `rotate` (replace the key; verifies before swapping)
 *   - `testCredentials` (re-verify the stored key)
 *   - `deleteCredentials` (remove vault entry + row)
 *   - `updateConfig` (change username/platforms without touching vault)
 *
 * Verification = a lightweight GET to Upload-Post's `/api/uploadposts/me`.
 */
"use node";

import { ConvexError, v } from "convex/values";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import type { ActionCtx } from "../_generated/server";
import { action } from "../_generated/server";
import { getRateLimitKey, rateLimiter } from "../_lib/rateLimits";

const UPLOAD_POST_VERIFY_URL = "https://api.upload-post.com/api/uploadposts/me";

const ALLOWED_PLATFORMS = new Set([
  "x",
  "linkedin",
  "bluesky",
  "threads",
  "facebook",
  "reddit",
]);

function validatePlatforms(platforms: string[]): string[] {
  const valid = platforms.filter((p) => ALLOWED_PLATFORMS.has(p));
  if (valid.length === 0) {
    throw new ConvexError({
      message: "Select at least one valid platform to post to.",
    });
  }
  return valid;
}

function normalizeSubreddit(raw: string): string {
  return raw.trim().replace(/^r\//i, "").replace(/\/+$/, "");
}

/**
 * Upload-Post usernames are user identifiers in the third-party service,
 * not free-form text — keep them to the same shape as a typical
 * social handle. The previous validator was length-only, which let through
 * control characters, newlines, and Unicode oddities that downstream form
 * fields and rendered UI weren't expecting.
 */
const USERNAME_RE = /^[A-Za-z0-9_.-]+$/;

function validateUsername(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new ConvexError({ message: "Upload-Post username is required." });
  }
  if (trimmed.length > 100) {
    throw new ConvexError({ message: "Username is too long." });
  }
  if (!USERNAME_RE.test(trimmed)) {
    throw new ConvexError({
      message:
        "Username may only contain letters, numbers, dots, dashes, and underscores.",
    });
  }
  return trimmed;
}

/* ------------------------------------------------------------------ */
/*  Public actions                                                      */
/* ------------------------------------------------------------------ */

export const setCredentials = action({
  args: {
    projectId: v.id("projects"),
    secret: v.string(),
    username: v.string(),
    platforms: v.array(v.string()),
    postTemplate: v.optional(v.string()),
    subreddit: v.optional(v.string()),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{
    credentialId: Id<"socialCredentials">;
    ok: boolean;
    message?: string;
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
    const username = validateUsername(args.username);
    const validPlatforms = validatePlatforms(args.platforms);
    if (args.postTemplate && args.postTemplate.length > 2000)
      throw new ConvexError({
        message: "Post template is too long (max 2000 characters).",
      });
    const subredditNorm = args.subreddit
      ? normalizeSubreddit(args.subreddit)
      : "";
    if (subredditNorm.length > 100)
      throw new ConvexError({ message: "Subreddit name is too long." });
    if (validPlatforms.includes("reddit") && !subredditNorm)
      throw new ConvexError({
        message: "Subreddit is required when Reddit is selected.",
      });

    const existing = await ctx.runQuery(
      internal.social.credentialsDb._findByProject,
      { projectId: args.projectId, provider: "upload-post" },
    );

    const configObj: {
      username: string;
      platforms: string[];
      postTemplate?: string;
      subreddit?: string;
    } = { username, platforms: validPlatforms };
    if (args.postTemplate !== undefined)
      configObj.postTemplate = args.postTemplate;
    if (subredditNorm) configObj.subreddit = subredditNorm;
    const publicConfig = JSON.stringify(configObj);

    // Verify-first when replacing an existing credential — never destroy
    // the working vault entry on a bad new secret.
    const verify = await verifyUploadPostKey(secret);
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
          provider: "upload-post",
          label: "upload-post-social-key",
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
        provider: "upload-post";
        vaultSecretId: string;
        vaultVersionId?: string;
        publicConfig: string;
      } = {
        projectId: args.projectId,
        userId: user._id,
        provider: "upload-post",
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

    const statusArgs: {
      credentialId: Id<"socialCredentials">;
      status: "active" | "invalid";
      lastVerifyError?: string;
      lastVerifiedAt?: number;
    } = {
      credentialId,
      status: verify.ok ? "active" : "invalid",
    };
    if (verify.ok) statusArgs.lastVerifiedAt = Date.now();
    else statusArgs.lastVerifyError = verify.message;
    await ctx.runMutation(internal.social.credentialsDb._setStatus, statusArgs);

    const result: {
      credentialId: Id<"socialCredentials">;
      ok: boolean;
      message?: string;
    } = { credentialId, ok: verify.ok };
    if (!verify.ok) result.message = verify.message;
    return result;
  },
});

export const testCredentials = action({
  args: { projectId: v.id("projects") },
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

    const verify = await verifyUploadPostKey(secret);
    const patch: {
      credentialId: Id<"socialCredentials">;
      status: "active" | "invalid";
      lastVerifyError?: string;
      lastVerifiedAt?: number;
    } = {
      credentialId: cred._id,
      status: verify.ok ? "active" : "invalid",
    };
    if (verify.ok) patch.lastVerifiedAt = Date.now();
    else patch.lastVerifyError = verify.message;
    await ctx.runMutation(internal.social.credentialsDb._setStatus, patch);
    return verify;
  },
});

export const rotate = action({
  args: {
    projectId: v.id("projects"),
    secret: v.string(),
  },
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

    const verify = await verifyUploadPostKey(newSecret);
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
          provider: "upload-post",
          label: "upload-post-social-key-rotated",
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
  args: { projectId: v.id("projects") },
  handler: async (ctx, args): Promise<void> => {
    const key = await getRateLimitKey(ctx);
    await rateLimiter.limit(ctx, "socialCredentials:delete", {
      key,
      throws: true,
    });

    const cred = await loadOwnedCredential(ctx, args.projectId);
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
  },
});

export const updateConfig = action({
  args: {
    projectId: v.id("projects"),
    username: v.optional(v.string()),
    platforms: v.optional(v.array(v.string())),
    postTemplate: v.optional(v.string()),
    subreddit: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<void> => {
    const key = await getRateLimitKey(ctx);
    await rateLimiter.limit(ctx, "socialCredentials:updateConfig", {
      key,
      throws: true,
    });

    const cred = await loadOwnedCredential(ctx, args.projectId);

    const nextUsername =
      args.username !== undefined ? validateUsername(args.username) : undefined;
    if (args.postTemplate !== undefined && args.postTemplate.length > 2000)
      throw new ConvexError({
        message: "Post template is too long (max 2000 characters).",
      });
    const subredditNorm =
      args.subreddit !== undefined
        ? normalizeSubreddit(args.subreddit)
        : undefined;
    if (subredditNorm !== undefined && subredditNorm.length > 100)
      throw new ConvexError({ message: "Subreddit name is too long." });

    const existing: {
      username?: string;
      platforms?: string[];
      postTemplate?: string;
      subreddit?: string;
    } = cred.publicConfig ? JSON.parse(cred.publicConfig) : {};
    const updated = {
      username: nextUsername ?? existing.username ?? "",
      platforms: args.platforms
        ? validatePlatforms(args.platforms)
        : (existing.platforms ?? []),
      postTemplate:
        args.postTemplate !== undefined
          ? args.postTemplate
          : (existing.postTemplate ?? ""),
      subreddit: subredditNorm ?? existing.subreddit ?? "",
    };
    if (!updated.username)
      throw new ConvexError({
        message: "Upload-Post username is required.",
      });
    if (updated.platforms.length === 0)
      throw new ConvexError({
        message: "Select at least one platform.",
      });
    if (updated.platforms.includes("reddit") && !updated.subreddit)
      throw new ConvexError({
        message: "Subreddit is required when Reddit is selected.",
      });

    await ctx.runMutation(internal.social.credentialsDb._updatePublicConfig, {
      credentialId: cred._id,
      publicConfig: JSON.stringify(updated),
    });
  },
});

/* ------------------------------------------------------------------ */
/*  Helpers                                                             */
/* ------------------------------------------------------------------ */

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
    { projectId, provider: "upload-post" },
  );
  if (!cred) {
    throw new ConvexError({
      message: "No Upload-Post credentials configured.",
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

async function verifyUploadPostKey(
  apiKey: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    const res = await fetch(UPLOAD_POST_VERIFY_URL, {
      headers: { Authorization: `Apikey ${apiKey}` },
      signal: AbortSignal.timeout(10_000),
    });
    if (res.ok) return { ok: true };
    if (res.status === 401)
      return { ok: false, message: "API key was rejected as invalid." };
    if (res.status === 403)
      return {
        ok: false,
        message: "API key lacks required permissions.",
      };
    return {
      ok: false,
      message: `Upload-Post returned ${res.status}. Try again later.`,
    };
  } catch (err) {
    const msg = (err as { message?: string })?.message ?? "Verification failed";
    return { ok: false, message: msg };
  }
}
