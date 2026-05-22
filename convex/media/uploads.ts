/**
 * Public media actions: upload, list, delete, getUsage.
 *
 * All uploads go directly to the project's configured provider — no Convex
 * file storage staging, no publish-time migration. The action is the only
 * server-side entry point; the browser never talks to UploadThing or
 * Cloudinary directly so credentials never leave Convex.
 *
 * Errors are normalized to `MediaErrorCode`s and propagated via
 * `ConvexError` so the client renders one of the friendly toasts in
 * `src/lib/media-errors.ts`.
 */
"use node";

import { ConvexError, v } from "convex/values";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import type { ActionCtx } from "../_generated/server";
import { action } from "../_generated/server";
import { isAllowedMime, QUOTAS } from "../_lib/quotas";
import { getRateLimitKey, rateLimiter } from "../_lib/rateLimits";
import {
  cldList,
  cldUpload,
  ghDelete,
  ghList,
  ghUpload,
  type NormalizedListItem,
  parseRepoString,
  utDelete,
  utList,
  utUpload,
} from "../providers";
import {
  DEFAULT_MESSAGES,
  type MediaErrorCode,
  redactError,
} from "../providers/errors";

type ActiveProvider = "github" | "uploadthing" | "cloudinary";

function resolveActiveProvider(mode: string | undefined): ActiveProvider {
  if (mode === "uploadthing" || mode === "cloudinary" || mode === "github") {
    return mode;
  }
  // Legacy "external" or undefined → default to github so writes still resolve.
  return "github";
}

/* ------------------------------------------------------------------ */
/*  Upload                                                              */
/* ------------------------------------------------------------------ */

/**
 * Direct provider upload. Validates everything we can check cheaply
 * (auth, file size, MIME, quotas, rate limits) before any provider call,
 * then dispatches based on the project's `mediaStorageMode`.
 */
export const upload = action({
  args: {
    projectId: v.id("projects"),
    bytes: v.bytes(),
    mime: v.string(),
    filename: v.string(),
    documentId: v.optional(v.id("documents")),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{
    mediaId: Id<"media">;
    url: string;
    provider: ActiveProvider;
    externalId: string;
  }> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const key = await getRateLimitKey(ctx);

    // ── Cheap checks first ──
    if (args.bytes.byteLength > QUOTAS.MAX_UPLOAD_BYTES) {
      throw new ConvexError({
        code: "FILE_TOO_LARGE" as MediaErrorCode,
        message: DEFAULT_MESSAGES.FILE_TOO_LARGE,
      });
    }
    if (!isAllowedMime(args.mime)) {
      throw new ConvexError({
        code: "UNSUPPORTED_MIME" as MediaErrorCode,
        message: DEFAULT_MESSAGES.UNSUPPORTED_MIME,
      });
    }

    // Rate limits — user, concurrency, and the global circuit breaker.
    await rateLimiter.limit(ctx, "media:upload", { key, throws: true });
    await rateLimiter.limit(ctx, "media:uploadConcurrency", {
      key,
      throws: true,
    });
    await rateLimiter.limit(ctx, "media:globalUpload", {
      key: "global",
      throws: true,
    });

    const owned = await ctx.runQuery(
      internal.media.uploadsDb._findOwnedProject,
      {
        tokenIdentifier: identity.tokenIdentifier,
        projectId: args.projectId,
      },
    );
    if (!owned) throw new Error("Unauthorized");

    // Per-project size limit (clamped to the absolute ceiling above).
    const projectMax =
      typeof owned.project.maxUploadBytes === "number" &&
      owned.project.maxUploadBytes > 0
        ? Math.min(owned.project.maxUploadBytes, QUOTAS.MAX_UPLOAD_BYTES)
        : QUOTAS.MAX_UPLOAD_BYTES;
    if (args.bytes.byteLength > projectMax) {
      throw new ConvexError({
        code: "FILE_TOO_LARGE" as MediaErrorCode,
        message: DEFAULT_MESSAGES.FILE_TOO_LARGE,
      });
    }

    // Project-level quota.
    const quota = await ctx.runQuery(internal.media.uploadsDb._quotaCheck, {
      projectId: args.projectId,
      incomingBytes: args.bytes.byteLength,
    });
    if (!quota.ok) {
      await logError(
        ctx,
        owned.userId,
        args.projectId,
        "convex",
        "upload",
        "PROJECT_QUOTA",
        `Project hit ${quota.reason} quota`,
      );
      throw new ConvexError({
        code: "PROJECT_QUOTA" as MediaErrorCode,
        message: DEFAULT_MESSAGES.PROJECT_QUOTA,
      });
    }

    const provider = resolveActiveProvider(owned.project.mediaStorageMode);
    const buffer = Buffer.from(new Uint8Array(args.bytes));

    try {
      let url: string;
      let externalId: string;
      let width: number | undefined;
      let height: number | undefined;
      let bytes = args.bytes.byteLength;

      if (provider === "uploadthing") {
        const cred = await ctx.runQuery(
          internal.media.uploadsDb._getCredential,
          {
            projectId: args.projectId,
            provider: "uploadthing",
          },
        );
        if (!cred || cred.status === "invalid") {
          throw new ConvexError({
            code: "AUTH_INVALID" as MediaErrorCode,
            message: DEFAULT_MESSAGES.AUTH_INVALID,
          });
        }
        await rateLimiter.limit(ctx, "vault:read", { key, throws: true });
        const token: string = await ctx.runAction(
          internal.integrations.secretStore._read,
          {
            id: cred.vaultSecretId,
          },
        );
        const res = await utUpload(token, {
          buffer,
          mime: args.mime,
          filename: args.filename,
        });
        url = res.url;
        externalId = res.externalId;
        bytes = res.bytes;
      } else if (provider === "cloudinary") {
        const cred = await ctx.runQuery(
          internal.media.uploadsDb._getCredential,
          {
            projectId: args.projectId,
            provider: "cloudinary",
          },
        );
        if (!cred || cred.status === "invalid") {
          throw new ConvexError({
            code: "AUTH_INVALID" as MediaErrorCode,
            message: DEFAULT_MESSAGES.AUTH_INVALID,
          });
        }
        await rateLimiter.limit(ctx, "vault:read", { key, throws: true });
        const rawSecret: string = await ctx.runAction(
          internal.integrations.secretStore._read,
          { id: cred.vaultSecretId },
        );
        const folder = owned.project.mediaPath ?? owned.project.slug;
        const res = await cldUpload(
          rawSecret,
          { buffer, mime: args.mime, filename: args.filename },
          { folder },
        );
        url = res.url;
        externalId = res.externalId;
        bytes = res.bytes;
        width = res.width;
        height = res.height;
      } else {
        // GitHub — direct repo commit.
        if (!owned.project.githubRepo) {
          throw new ConvexError({
            code: "AUTH_INVALID" as MediaErrorCode,
            message:
              "This project has no GitHub repo configured. Add one in settings before uploading.",
          });
        }
        const { owner, repo } = parseRepoString(owned.project.githubRepo);
        const { getGithubToken } = await import("../_lib/auth");
        const token = await getGithubToken(ctx, owned.userId);
        if (!token) {
          throw new ConvexError({
            code: "AUTH_INVALID" as MediaErrorCode,
            message:
              "GitHub isn't connected. Reconnect in settings before uploading.",
          });
        }
        const spec = {
          owner,
          repo,
          branch: owned.project.githubBranch ?? "main",
          mediaPath: owned.project.mediaPath ?? "public/images",
        };
        const res = await ghUpload(token, spec, {
          buffer,
          mime: args.mime,
          filename: args.filename,
        });
        url = res.url;
        externalId = res.externalId;
        bytes = res.bytes;
      }

      const recordArgs: {
        projectId: Id<"projects">;
        userId: Id<"users">;
        provider: ActiveProvider;
        externalId: string;
        url: string;
        filename: string;
        mime: string;
        bytes: number;
        width?: number;
        height?: number;
        documentId?: Id<"documents">;
      } = {
        projectId: args.projectId,
        userId: owned.userId,
        provider,
        externalId,
        url,
        filename: args.filename,
        mime: args.mime,
        bytes,
      };
      if (width !== undefined) recordArgs.width = width;
      if (height !== undefined) recordArgs.height = height;
      if (args.documentId !== undefined)
        recordArgs.documentId = args.documentId;

      const mediaId = await ctx.runMutation(
        internal.media.uploadsDb._recordUpload,
        recordArgs,
      );

      return { mediaId, url, provider, externalId };
    } catch (err) {
      if (err instanceof ConvexError) {
        await logError(
          ctx,
          owned.userId,
          args.projectId,
          provider,
          "upload",
          (err.data as { code?: string })?.code ?? "UNKNOWN",
          (err.data as { message?: string })?.message ?? "Upload failed",
          redactError(err),
        );
        throw err;
      }
      // Unexpected error — wrap, log, rethrow as ConvexError so the client
      // never sees a raw provider stack.
      const message = (err as { message?: string })?.message ?? "Upload failed";
      await logError(
        ctx,
        owned.userId,
        args.projectId,
        provider,
        "upload",
        "UNKNOWN",
        message,
        redactError(err),
      );
      throw new ConvexError({
        code: "UNKNOWN" as MediaErrorCode,
        message: DEFAULT_MESSAGES.UNKNOWN,
      });
    }
  },
});

/* ------------------------------------------------------------------ */
/*  List                                                                 */
/* ------------------------------------------------------------------ */

export const list = action({
  args: {
    projectId: v.id("projects"),
    cursor: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{
    provider: ActiveProvider;
    items: NormalizedListItem[];
    nextCursor: string | null;
  }> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const key = await getRateLimitKey(ctx);
    await rateLimiter.limit(ctx, "media:list", { key, throws: true });

    const owned = await ctx.runQuery(
      internal.media.uploadsDb._findOwnedProject,
      {
        tokenIdentifier: identity.tokenIdentifier,
        projectId: args.projectId,
      },
    );
    if (!owned) throw new Error("Unauthorized");

    const provider = resolveActiveProvider(owned.project.mediaStorageMode);
    const max = Math.min(args.limit ?? 50, 100);

    try {
      if (provider === "uploadthing") {
        const cred = await ctx.runQuery(
          internal.media.uploadsDb._getCredential,
          {
            projectId: args.projectId,
            provider: "uploadthing",
          },
        );
        if (!cred) return { provider, items: [], nextCursor: null };
        await rateLimiter.limit(ctx, "vault:read", { key, throws: true });
        const token: string = await ctx.runAction(
          internal.integrations.secretStore._read,
          {
            id: cred.vaultSecretId,
          },
        );
        const offset = args.cursor ? Number(args.cursor) : 0;
        const { items, hasMore } = await utList(token, {
          limit: max,
          offset,
        });
        return {
          provider,
          items,
          nextCursor: hasMore ? String(offset + items.length) : null,
        };
      }

      if (provider === "cloudinary") {
        const cred = await ctx.runQuery(
          internal.media.uploadsDb._getCredential,
          {
            projectId: args.projectId,
            provider: "cloudinary",
          },
        );
        if (!cred) return { provider, items: [], nextCursor: null };
        await rateLimiter.limit(ctx, "vault:read", { key, throws: true });
        const rawSecret: string = await ctx.runAction(
          internal.integrations.secretStore._read,
          { id: cred.vaultSecretId },
        );
        const folder = owned.project.mediaPath ?? owned.project.slug;
        const listOpts: {
          folder?: string;
          nextCursor?: string;
          max?: number;
        } = { max };
        if (folder) listOpts.folder = folder;
        if (args.cursor) listOpts.nextCursor = args.cursor;
        const { items, nextCursor } = await cldList(rawSecret, listOpts);
        return { provider, items, nextCursor: nextCursor ?? null };
      }

      // GitHub
      if (!owned.project.githubRepo) {
        return { provider, items: [], nextCursor: null };
      }
      const { owner, repo } = parseRepoString(owned.project.githubRepo);
      const { getGithubToken } = await import("../_lib/auth");
      const token = await getGithubToken(ctx, owned.userId);
      if (!token) return { provider, items: [], nextCursor: null };
      const { items } = await ghList(token, {
        owner,
        repo,
        branch: owned.project.githubBranch ?? "main",
        mediaPath: owned.project.mediaPath ?? "public/images",
      });
      return { provider, items, nextCursor: null };
    } catch (err) {
      if (err instanceof ConvexError) throw err;
      const message = (err as { message?: string })?.message ?? "List failed";
      await logError(
        ctx,
        owned.userId,
        args.projectId,
        provider,
        "list",
        "UNKNOWN",
        message,
        redactError(err),
      );
      throw new ConvexError({
        code: "UNKNOWN" as MediaErrorCode,
        message: DEFAULT_MESSAGES.UNKNOWN,
      });
    }
  },
});

/* ------------------------------------------------------------------ */
/*  Delete                                                              */
/* ------------------------------------------------------------------ */

export const del = action({
  args: { mediaId: v.id("media") },
  handler: async (ctx, args): Promise<void> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const key = await getRateLimitKey(ctx);
    await rateLimiter.limit(ctx, "media:delete", { key, throws: true });

    const row = await ctx.runQuery(internal.media.uploadsDb._getById, {
      mediaId: args.mediaId,
    });
    if (!row) return;

    const owned = await ctx.runQuery(
      internal.media.uploadsDb._findOwnedProject,
      {
        tokenIdentifier: identity.tokenIdentifier,
        projectId: row.projectId,
      },
    );
    if (!owned) throw new Error("Unauthorized");

    const provider = row.provider ?? "convex_legacy";
    try {
      if (provider === "uploadthing" && row.externalId) {
        const cred = await ctx.runQuery(
          internal.media.uploadsDb._getCredential,
          {
            projectId: row.projectId,
            provider: "uploadthing",
          },
        );
        if (cred) {
          await rateLimiter.limit(ctx, "vault:read", { key, throws: true });
          const token: string = await ctx.runAction(
            internal.integrations.secretStore._read,
            { id: cred.vaultSecretId },
          );
          await utDelete(token, [row.externalId]);
        }
      } else if (provider === "cloudinary" && row.externalId) {
        const cred = await ctx.runQuery(
          internal.media.uploadsDb._getCredential,
          {
            projectId: row.projectId,
            provider: "cloudinary",
          },
        );
        if (cred) {
          await rateLimiter.limit(ctx, "vault:read", { key, throws: true });
          const rawSecret: string = await ctx.runAction(
            internal.integrations.secretStore._read,
            { id: cred.vaultSecretId },
          );
          // Cloudinary's destroy needs the public_id; that's what we stored.
          const { cldDelete: cldDeleteFn } = await import("../providers");
          await cldDeleteFn(rawSecret, row.externalId);
        }
      } else if (provider === "github" && row.externalId) {
        const project = owned.project;
        if (project.githubRepo) {
          const { owner, repo } = parseRepoString(project.githubRepo);
          const { getGithubToken } = await import("../_lib/auth");
          const token = await getGithubToken(ctx, owned.userId);
          if (token) {
            // GitHub delete needs the current blob sha; re-list to find it.
            const listed = await ghList(token, {
              owner,
              repo,
              branch: project.githubBranch ?? "main",
              mediaPath: project.mediaPath ?? "public/images",
            });
            const match = listed.items.find(
              (i) => i.externalId === row.externalId,
            );
            if (match) {
              await ghDelete(
                token,
                {
                  owner,
                  repo,
                  branch: project.githubBranch ?? "main",
                  mediaPath: project.mediaPath ?? "public/images",
                },
                row.externalId,
                match.sha,
              );
            }
          }
        }
      } else if (provider === "convex_legacy" && row.storageId) {
        // Legacy: still living in Convex storage. Delete the blob too.
        await ctx.storage.delete(row.storageId);
      }
    } catch (err) {
      if (err instanceof ConvexError) throw err;
      const message = (err as { message?: string })?.message ?? "Delete failed";
      await logError(
        ctx,
        owned.userId,
        row.projectId,
        String(provider),
        "delete",
        "UNKNOWN",
        message,
        redactError(err),
      );
      throw new ConvexError({
        code: "UNKNOWN" as MediaErrorCode,
        message: DEFAULT_MESSAGES.UNKNOWN,
      });
    }

    await ctx.runMutation(internal.media.uploadsDb._deleteRow, {
      mediaId: args.mediaId,
    });
  },
});

/**
 * Delete a media file by provider + externalId. Used by the media library
 * page where listings come straight from the provider — many of those files
 * may not have a corresponding row in our `media` table (e.g. files uploaded
 * to UploadThing / Cloudinary outside this app).
 *
 * Behavior:
 *  - UploadThing: deletes by file key.
 *  - Cloudinary: deletes by public_id.
 *  - GitHub: requires `sha` (the GitHub blob SHA from the listing) so we
 *    don't double-fetch on every delete.
 * In every case, also removes a matching row in `media` if one exists.
 */
export const deleteByRef = action({
  args: {
    projectId: v.id("projects"),
    provider: v.union(
      v.literal("github"),
      v.literal("uploadthing"),
      v.literal("cloudinary"),
    ),
    externalId: v.string(),
    /** GitHub blob SHA — required for "github". Ignored otherwise. */
    sha: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<void> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const key = await getRateLimitKey(ctx);
    await rateLimiter.limit(ctx, "media:delete", { key, throws: true });

    const owned = await ctx.runQuery(
      internal.media.uploadsDb._findOwnedProject,
      {
        tokenIdentifier: identity.tokenIdentifier,
        projectId: args.projectId,
      },
    );
    if (!owned) throw new Error("Unauthorized");

    try {
      if (args.provider === "uploadthing") {
        const cred = await ctx.runQuery(
          internal.media.uploadsDb._getCredential,
          {
            projectId: args.projectId,
            provider: "uploadthing",
          },
        );
        if (!cred) {
          throw new ConvexError({
            code: "AUTH_INVALID" as MediaErrorCode,
            message: DEFAULT_MESSAGES.AUTH_INVALID,
          });
        }
        await rateLimiter.limit(ctx, "vault:read", { key, throws: true });
        const token: string = await ctx.runAction(
          internal.integrations.secretStore._read,
          {
            id: cred.vaultSecretId,
          },
        );
        await utDelete(token, [args.externalId]);
      } else if (args.provider === "cloudinary") {
        const cred = await ctx.runQuery(
          internal.media.uploadsDb._getCredential,
          {
            projectId: args.projectId,
            provider: "cloudinary",
          },
        );
        if (!cred) {
          throw new ConvexError({
            code: "AUTH_INVALID" as MediaErrorCode,
            message: DEFAULT_MESSAGES.AUTH_INVALID,
          });
        }
        await rateLimiter.limit(ctx, "vault:read", { key, throws: true });
        const rawSecret: string = await ctx.runAction(
          internal.integrations.secretStore._read,
          { id: cred.vaultSecretId },
        );
        const { cldDelete } = await import("../providers");
        await cldDelete(rawSecret, args.externalId);
      } else {
        // GitHub
        if (!args.sha) {
          throw new ConvexError({
            code: "UNKNOWN" as MediaErrorCode,
            message: "GitHub deletes require a blob SHA.",
          });
        }
        if (!owned.project.githubRepo) {
          throw new ConvexError({
            code: "AUTH_INVALID" as MediaErrorCode,
            message: "GitHub repository is not configured.",
          });
        }
        const { owner, repo } = parseRepoString(owned.project.githubRepo);
        const { getGithubToken } = await import("../_lib/auth");
        const token = await getGithubToken(ctx, owned.userId);
        if (!token) {
          throw new ConvexError({
            code: "AUTH_INVALID" as MediaErrorCode,
            message: "GitHub isn't connected.",
          });
        }
        await ghDelete(
          token,
          {
            owner,
            repo,
            branch: owned.project.githubBranch ?? "main",
            mediaPath: owned.project.mediaPath ?? "public/images",
          },
          args.externalId,
          args.sha,
        );
      }
    } catch (err) {
      if (err instanceof ConvexError) throw err;
      const message = (err as { message?: string })?.message ?? "Delete failed";
      await logError(
        ctx,
        owned.userId,
        args.projectId,
        args.provider,
        "delete",
        "UNKNOWN",
        message,
        redactError(err),
      );
      throw new ConvexError({
        code: "UNKNOWN" as MediaErrorCode,
        message: DEFAULT_MESSAGES.UNKNOWN,
      });
    }

    // Best-effort: remove any matching media row + decrement usage.
    const row = await ctx.runQuery(
      internal.media.uploadsDb._findByProviderAndExternalId,
      {
        provider: args.provider,
        externalId: args.externalId,
      },
    );
    if (row) {
      await ctx.runMutation(internal.media.uploadsDb._deleteRow, {
        mediaId: row._id,
      });
    }
  },
});

/* ------------------------------------------------------------------ */
/*  Helpers                                                              */
/* ------------------------------------------------------------------ */

async function logError(
  ctx: ActionCtx,
  userId: Id<"users">,
  projectId: Id<"projects">,
  provider: string,
  operation: string,
  errorCode: string,
  errorMessage: string,
  providerError?: string,
): Promise<void> {
  try {
    const args: {
      projectId: Id<"projects">;
      userId: Id<"users">;
      provider: string;
      operation: string;
      errorCode: string;
      errorMessage: string;
      providerError?: string;
    } = {
      projectId,
      userId,
      provider,
      operation,
      errorCode,
      errorMessage,
    };
    if (providerError !== undefined) args.providerError = providerError;
    await ctx.runMutation(internal.media.uploadsDb._logError, args);
  } catch {
    // Logging is best-effort; never let it mask the original error.
  }
}
