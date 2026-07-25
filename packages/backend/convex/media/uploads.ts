/**
 * Public media actions: upload, list, delete.
 *
 * All uploads go directly to a project's storage provider — no Convex file
 * storage staging, no publish-time migration. These actions are the only
 * server-side entry point; the browser never talks to UploadThing, Cloudinary
 * or R2 directly, so credentials never leave Convex.
 *
 * Every provider-specific detail lives in `convex/providers/registry.ts`, and
 * *which* provider handles a request lives in `./providerResolution.ts`. What
 * remains here is the part that is identical for all of them: auth, quotas,
 * rate limits, filename hardening, bookkeeping and error normalisation.
 *
 * A project can have several providers connected at once. Requests take an
 * optional `provider`; without one they route to the project's default
 * (`mediaStorageMode`).
 *
 * Errors are normalised to `MediaErrorCode`s and propagated via `ConvexError`
 * so the client renders one of the friendly toasts in `src/lib/media-errors.ts`.
 */
"use node";

import { ConvexError, v } from "convex/values";
import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import type { ActionCtx } from "../_generated/server";
import { action } from "../_generated/server";
import { isAllowedMime, QUOTAS } from "../_lib/quotas";
import { rateLimiter } from "../_lib/rateLimits";
import {
  DEFAULT_MESSAGES,
  type MediaErrorCode,
  redactError,
} from "../providers/errors";
import {
  type MediaProvider,
  mediaProviderValidator,
  type NormalizedMediaItem,
} from "./_lib/providers";
import {
  resolveProvider,
  resolveProviderName,
  tryResolveProvider,
} from "./providerResolution";

/**
 * Resolves the acting user from `ctx.auth` inside an action.
 *
 * Media actions previously used `identity.tokenIdentifier` directly for both
 * rate limiting and the owned-project lookup. Resolving the `users` row once
 * instead lets the same bodies be reused by the MCP handlers, which are handed
 * an already-resolved caller because component-dispatched tools have no
 * `ctx.auth` — see `_lib/auth.ts → requireCallerInAction`.
 */
async function requireUserFromAuth(ctx: ActionCtx): Promise<Doc<"users">> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error("Not authenticated");
  const user = await ctx.runQuery(internal.account.users.internalGetByToken, {
    tokenIdentifier: identity.tokenIdentifier,
  });
  if (!user) throw new Error("User not found");
  return user;
}

/** Loads the project, asserting the caller owns it. */
async function requireOwnedProject(
  ctx: ActionCtx,
  user: Doc<"users">,
  projectId: Id<"projects">,
): Promise<{ project: Doc<"projects">; userId: Id<"users"> }> {
  const owned = await ctx.runQuery(internal.media.uploadsDb._findOwnedProject, {
    tokenIdentifier: user.tokenIdentifier,
    projectId,
  });
  if (!owned) throw new Error("Unauthorized");
  return owned;
}

/**
 * Reduces an untrusted filename to a single safe path segment. The result is
 * concatenated into provider URLs, object keys and GitHub repo paths
 * (`${mediaPath}/${filename}`), so any directory-traversal sequence would let
 * a caller escape the configured media directory.
 *
 * Rules:
 *  - Take only the last segment after splitting on both `/` and `\`
 *  - Reject NUL bytes outright (no realistic legitimate use)
 *  - Reject `.`, `..`, or empty results
 *  - Cap at 255 chars (long enough for any reasonable upload, short enough to
 *    fit any filesystem)
 */
function sanitizeFilename(input: string): string {
  if (input.includes("\0")) {
    throw new ConvexError({
      code: "UNKNOWN" as MediaErrorCode,
      message: "Filename contains invalid characters",
    });
  }
  const lastSegment = input.split(/[\\/]/).pop()?.trim() ?? "";
  if (!lastSegment || lastSegment === "." || lastSegment === "..") {
    throw new ConvexError({
      code: "UNKNOWN" as MediaErrorCode,
      message: "Filename is required and must not be a directory reference",
    });
  }
  if (lastSegment.length > 255) {
    throw new ConvexError({
      code: "UNKNOWN" as MediaErrorCode,
      message: "Filename is too long (max 255 characters)",
    });
  }
  return lastSegment;
}

/* ------------------------------------------------------------------ */
/*  Upload                                                              */
/* ------------------------------------------------------------------ */

export const upload = action({
  args: {
    projectId: v.id("projects"),
    bytes: v.bytes(),
    mime: v.string(),
    filename: v.string(),
    documentId: v.optional(v.id("documents")),
    /** Destination override. Omit to use the project's default provider. */
    provider: v.optional(mediaProviderValidator),
  },
  handler: async (ctx, args) =>
    await uploadForUser(ctx, await requireUserFromAuth(ctx), args),
});

/** `upload`'s body with the actor passed in explicitly. Shared with the MCP
 *  handler — see `requireUserFromAuth` above. */
export async function uploadForUser(
  ctx: ActionCtx,
  user: Doc<"users">,
  args: {
    projectId: Id<"projects">;
    bytes: ArrayBuffer;
    mime: string;
    filename: string;
    documentId?: Id<"documents">;
    provider?: MediaProvider;
  },
): Promise<{
  mediaId: Id<"media">;
  url: string;
  provider: MediaProvider;
  externalId: string;
}> {
  const key = user.tokenIdentifier;

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

  // Path traversal guard. The filename is concatenated into provider URLs,
  // object keys and GitHub repo paths — a `../` segment would let a caller
  // escape the configured media directory and overwrite e.g.
  // `.github/workflows/*`.
  const safeFilename = sanitizeFilename(args.filename);

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

  const owned = await requireOwnedProject(ctx, user, args.projectId);

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

  // Named before the try block so the error path can attribute failures even
  // when resolution itself is what threw.
  const provider = resolveProviderName(owned.project, args.provider);

  try {
    const { adapter, cx } = await resolveProvider(ctx, {
      project: owned.project,
      userId: owned.userId,
      requested: args.provider,
      rateKey: key,
      requireValid: true,
    });

    const res = await adapter.upload(cx, {
      buffer: Buffer.from(new Uint8Array(args.bytes)),
      mime: args.mime,
      filename: safeFilename,
    });

    const mediaId: Id<"media"> = await ctx.runMutation(
      internal.media.uploadsDb._recordUpload,
      {
        projectId: args.projectId,
        userId: owned.userId,
        provider,
        externalId: res.externalId,
        url: res.url,
        filename: safeFilename,
        mime: args.mime,
        bytes: res.bytes,
        ...(res.width !== undefined ? { width: res.width } : {}),
        ...(res.height !== undefined ? { height: res.height } : {}),
        ...(args.documentId !== undefined
          ? { documentId: args.documentId }
          : {}),
      },
    );

    return { mediaId, url: res.url, provider, externalId: res.externalId };
  } catch (err) {
    throw await normalizeFailure(
      ctx,
      err,
      { userId: owned.userId, projectId: args.projectId, provider },
      "upload",
      "Upload failed",
    );
  }
}

/* ------------------------------------------------------------------ */
/*  Upload (base64) — MCP entry point                                    */
/* ------------------------------------------------------------------ */

/**
 * Base64 twin of {@link upload}, for callers that can't send binary.
 *
 * `upload` takes `v.bytes()`, which has no representation in JSON-RPC — the
 * MCP transport is JSON, so an ArrayBuffer argument can't survive the wire.
 * A base64 string is also a far better argument for a language model to
 * produce than Convex's `{"$bytes": …}` envelope.
 *
 * Deliberately a thin decode-and-delegate rather than a second copy of the
 * upload pipeline: provider routing, quota checks, path-traversal guards,
 * rate limits and error normalisation all stay in exactly one place. The cost
 * is one extra action hop per upload, which is irrelevant at media-upload
 * frequency (single digits per minute, per the `media:upload` limit).
 */
export const uploadBase64 = action({
  args: {
    projectId: v.id("projects"),
    base64: v.string(),
    mime: v.string(),
    filename: v.string(),
    documentId: v.optional(v.id("documents")),
    provider: v.optional(mediaProviderValidator),
  },
  handler: async (ctx, args) =>
    await uploadBase64ForUser(ctx, await requireUserFromAuth(ctx), args),
});

/** `uploadBase64`'s body with the actor passed in explicitly. Shared with the
 *  MCP handler — see `requireUserFromAuth` above. */
export async function uploadBase64ForUser(
  ctx: ActionCtx,
  user: Doc<"users">,
  args: {
    projectId: Id<"projects">;
    base64: string;
    mime: string;
    filename: string;
    documentId?: Id<"documents">;
    provider?: MediaProvider;
  },
): Promise<{
  mediaId: Id<"media">;
  url: string;
  provider: MediaProvider;
  externalId: string;
}> {
  // Reject oversized payloads before decoding: base64 inflates by ~4/3, so
  // checking the encoded length first avoids allocating a buffer we're only
  // going to throw away. `upload` re-checks the true byte length anyway.
  const approxBytes = Math.floor((args.base64.length * 3) / 4);
  if (approxBytes > QUOTAS.MAX_UPLOAD_BYTES) {
    throw new ConvexError({
      code: "FILE_TOO_LARGE" as MediaErrorCode,
      message: DEFAULT_MESSAGES.FILE_TOO_LARGE,
    });
  }

  let buffer: Buffer;
  try {
    // `base64` is strict here: Node's decoder silently ignores invalid
    // characters, so a truncated or mangled payload would otherwise upload
    // as a corrupt image rather than failing loudly.
    buffer = Buffer.from(args.base64, "base64");
    if (buffer.length === 0) throw new Error("empty");
  } catch {
    throw new ConvexError({
      code: "UNSUPPORTED_MIME" as MediaErrorCode,
      message: "Could not decode base64 payload.",
    });
  }

  // Calls the shared body directly rather than `ctx.runAction(api...upload)`:
  // one fewer action hop per upload, and it works for an MCP caller, where
  // dispatching back through a public action would lose the identity again.
  return await uploadForUser(ctx, user, {
    projectId: args.projectId,
    bytes: buffer.buffer.slice(
      buffer.byteOffset,
      buffer.byteOffset + buffer.byteLength,
    ) as ArrayBuffer,
    mime: args.mime,
    filename: args.filename,
    ...(args.documentId !== undefined ? { documentId: args.documentId } : {}),
    ...(args.provider !== undefined ? { provider: args.provider } : {}),
  });
}

/* ------------------------------------------------------------------ */
/*  List                                                                 */
/* ------------------------------------------------------------------ */

export const list = action({
  args: {
    projectId: v.id("projects"),
    cursor: v.optional(v.string()),
    limit: v.optional(v.number()),
    /** Which connected provider to browse. Omit for the project's default. */
    provider: v.optional(mediaProviderValidator),
  },
  handler: async (ctx, args) =>
    await listMediaForUser(ctx, await requireUserFromAuth(ctx), args),
});

/** `list`'s body with the actor passed in explicitly. */
export async function listMediaForUser(
  ctx: ActionCtx,
  user: Doc<"users">,
  args: {
    projectId: Id<"projects">;
    cursor?: string;
    limit?: number;
    provider?: MediaProvider;
  },
): Promise<{
  provider: MediaProvider;
  items: NormalizedMediaItem[];
  nextCursor: string | null;
}> {
  const key = user.tokenIdentifier;
  await rateLimiter.limit(ctx, "media:list", { key, throws: true });

  const owned = await requireOwnedProject(ctx, user, args.projectId);
  const provider = resolveProviderName(owned.project, args.provider);

  try {
    // A provider that isn't connected yet lists as empty rather than failing —
    // the UI renders its "connect this provider" state from that.
    const resolved = await tryResolveProvider(ctx, {
      project: owned.project,
      userId: owned.userId,
      requested: args.provider,
      rateKey: key,
    });
    if (!resolved) return { provider, items: [], nextCursor: null };

    const { items, nextCursor } = await resolved.adapter.list(resolved.cx, {
      cursor: args.cursor,
      limit: Math.min(args.limit ?? 50, 100),
    });
    return { provider, items, nextCursor };
  } catch (err) {
    throw await normalizeFailure(
      ctx,
      err,
      { userId: owned.userId, projectId: args.projectId, provider },
      "list",
      "List failed",
    );
  }
}

/* ------------------------------------------------------------------ */
/*  Delete                                                              */
/* ------------------------------------------------------------------ */

/** Deletes a tracked upload: removes it at the provider, then drops the row. */
export const del = action({
  args: { mediaId: v.id("media") },
  handler: async (ctx, args): Promise<void> => {
    const user = await requireUserFromAuth(ctx);
    const key = user.tokenIdentifier;
    await rateLimiter.limit(ctx, "media:delete", { key, throws: true });

    const row = await ctx.runQuery(internal.media.uploadsDb._getById, {
      mediaId: args.mediaId,
    });
    if (!row) return;

    const owned = await requireOwnedProject(ctx, user, row.projectId);
    const provider = row.provider ?? "github";

    if (row.externalId) {
      try {
        // Best-effort: a provider that has since been disconnected shouldn't
        // strand the row in our table forever.
        const resolved = await tryResolveProvider(ctx, {
          project: owned.project,
          userId: owned.userId,
          requested: provider,
          rateKey: key,
        });
        if (resolved) {
          await resolved.adapter.remove(resolved.cx, {
            externalId: row.externalId,
          });
        }
      } catch (err) {
        throw await normalizeFailure(
          ctx,
          err,
          { userId: owned.userId, projectId: row.projectId, provider },
          "delete",
          "Delete failed",
        );
      }
    }

    await ctx.runMutation(internal.media.uploadsDb._deleteRow, {
      mediaId: args.mediaId,
    });
  },
});

/**
 * Delete a media file by provider + externalId. Used by the media library
 * page, where listings come straight from the provider — many of those files
 * have no row in our `media` table (e.g. files uploaded to the same bucket
 * outside this app).
 *
 * `sha` is an optimisation, not a requirement: GitHub deletes need the current
 * blob SHA, and passing the one from the listing saves the adapter a lookup.
 */
export const deleteByRef = action({
  args: {
    projectId: v.id("projects"),
    provider: mediaProviderValidator,
    externalId: v.string(),
    /** GitHub blob SHA from the listing. Ignored by other providers. */
    sha: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<void> => {
    const user = await requireUserFromAuth(ctx);
    const key = user.tokenIdentifier;
    await rateLimiter.limit(ctx, "media:delete", { key, throws: true });

    const owned = await requireOwnedProject(ctx, user, args.projectId);

    try {
      const { adapter, cx } = await resolveProvider(ctx, {
        project: owned.project,
        userId: owned.userId,
        requested: args.provider,
        rateKey: key,
      });
      await adapter.remove(cx, {
        externalId: args.externalId,
        ...(args.sha !== undefined ? { sha: args.sha } : {}),
      });
    } catch (err) {
      throw await normalizeFailure(
        ctx,
        err,
        {
          userId: owned.userId,
          projectId: args.projectId,
          provider: args.provider,
        },
        "delete",
        "Delete failed",
      );
    }

    // Best-effort: remove any matching media row + decrement usage.
    const row = await ctx.runQuery(
      internal.media.uploadsDb._findByProviderAndExternalId,
      {
        projectId: args.projectId,
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

/**
 * Logs a provider failure and returns the error to throw.
 *
 * `ConvexError`s already carry a normalised code from the adapter, so they pass
 * through untouched. Anything else is logged with a redacted original and
 * replaced by a generic error, so a raw provider stack never reaches a client.
 */
async function normalizeFailure(
  ctx: ActionCtx,
  err: unknown,
  where: {
    userId: Id<"users">;
    projectId: Id<"projects">;
    provider: MediaProvider;
  },
  operation: "upload" | "list" | "delete",
  fallbackMessage: string,
): Promise<unknown> {
  if (err instanceof ConvexError) {
    const data = err.data as { code?: string; message?: string };
    await logError(
      ctx,
      where.userId,
      where.projectId,
      where.provider,
      operation,
      data?.code ?? "UNKNOWN",
      data?.message ?? fallbackMessage,
      redactError(err),
    );
    return err;
  }
  await logError(
    ctx,
    where.userId,
    where.projectId,
    where.provider,
    operation,
    "UNKNOWN",
    (err as { message?: string })?.message ?? fallbackMessage,
    redactError(err),
  );
  return new ConvexError({
    code: "UNKNOWN" as MediaErrorCode,
    message: DEFAULT_MESSAGES.UNKNOWN,
  });
}

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
    await ctx.runMutation(internal.media.uploadsDb._logError, {
      projectId,
      userId,
      provider,
      operation,
      errorCode,
      errorMessage,
      ...(providerError !== undefined ? { providerError } : {}),
    });
  } catch {
    // Logging is best-effort; never let it mask the original error.
  }
}
