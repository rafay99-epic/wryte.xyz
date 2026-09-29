"use node";

import { ConvexError, v } from "convex/values";
import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import type { ActionCtx } from "../_generated/server";
import { action } from "../_generated/server";
import { isAllowedMime, projectUploadLimit, QUOTAS } from "../_lib/quotas";
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
  filenameFromUrl,
  parseRemoteMediaUrl,
  readCapped,
} from "./_lib/remote";
import {
  resolveProvider,
  resolveProviderName,
  tryResolveProvider,
} from "./providerResolution";

async function requireUserFromAuth(ctx: ActionCtx): Promise<Doc<"users">> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error("Not authenticated");
  const user = await ctx.runQuery(internal.account.users.internalGetByToken, {
    tokenIdentifier: identity.tokenIdentifier,
  });
  if (!user) throw new Error("User not found");
  return user;
}

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

export const upload = action({
  args: {
    projectId: v.id("projects"),
    bytes: v.bytes(),
    mime: v.string(),
    filename: v.string(),
    documentId: v.optional(v.id("documents")),
    provider: v.optional(mediaProviderValidator),
  },
  handler: async (ctx, args) =>
    await uploadForUser(ctx, await requireUserFromAuth(ctx), args),
});

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

  const safeFilename = sanitizeFilename(args.filename);

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

  if (args.bytes.byteLength > projectUploadLimit(owned.project)) {
    throw new ConvexError({
      code: "FILE_TOO_LARGE" as MediaErrorCode,
      message: DEFAULT_MESSAGES.FILE_TOO_LARGE,
    });
  }

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

const BASE64_RE = /^[A-Za-z0-9+/_-]+={0,2}$/;

function decodeBase64(raw: string): ArrayBuffer {
  if (Math.floor((raw.length * 3) / 4) > QUOTAS.MAX_UPLOAD_BYTES) {
    throw new ConvexError({
      code: "FILE_TOO_LARGE" as MediaErrorCode,
      message: DEFAULT_MESSAGES.FILE_TOO_LARGE,
    });
  }

  const base64 = raw.replace(/\s+/g, "");
  const unpadded = base64.replace(/=+$/, "");
  const validBase64 =
    base64.length > 0 &&
    BASE64_RE.test(base64) &&
    unpadded.length % 4 !== 1 &&
    (unpadded.length === base64.length || base64.length % 4 === 0);
  if (!validBase64) {
    throw new ConvexError({
      code: "UNKNOWN" as MediaErrorCode,
      message: "Could not decode base64 payload.",
    });
  }
  const buffer = Buffer.from(base64, "base64");
  return new Uint8Array(buffer).buffer;
}

export type MediaSource =
  | { kind: "url"; url: string }
  | { kind: "base64"; base64: string };

export type LoadedMedia = {
  bytes: ArrayBuffer;
  mime: string | null;
  filename: string | null;
};

export async function loadMediaSource(
  source: MediaSource,
): Promise<LoadedMedia> {
  switch (source.kind) {
    case "base64":
      return {
        bytes: decodeBase64(source.base64),
        mime: null,
        filename: null,
      };
    case "url": {
      const url = parseRemoteMediaUrl(source.url);
      const response = await fetch(url, { redirect: "follow" });
      if (!response.ok) {
        throw new Error(
          `sourceUrl responded ${String(response.status)} ${response.statusText}`,
        );
      }
      parseRemoteMediaUrl(response.url || url.toString());
      const mime =
        response.headers.get("content-type")?.split(";")[0]?.trim() ?? "";
      if (!isAllowedMime(mime)) {
        throw new ConvexError({
          code: "UNSUPPORTED_MIME" as MediaErrorCode,
          message: DEFAULT_MESSAGES.UNSUPPORTED_MIME,
        });
      }
      return {
        bytes: await readCapped(response, QUOTAS.MAX_UPLOAD_BYTES),
        mime,
        filename: filenameFromUrl(url, mime),
      };
    }
  }
}

export const list = action({
  args: {
    projectId: v.id("projects"),
    cursor: v.optional(v.string()),
    limit: v.optional(v.number()),
    provider: v.optional(mediaProviderValidator),
  },
  handler: async (ctx, args) =>
    await listMediaForUser(ctx, await requireUserFromAuth(ctx), args),
});

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

export const deleteByRef = action({
  args: {
    projectId: v.id("projects"),
    provider: mediaProviderValidator,
    externalId: v.string(),
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
  } catch {}
}
