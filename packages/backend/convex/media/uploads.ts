"use node";

import { ConvexError, v } from "convex/values";
import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import type { ActionCtx } from "../_generated/server";
import { action, internalAction } from "../_generated/server";
import { isAllowedMime, QUOTAS } from "../_lib/quotas";
import { rateLimiter } from "../_lib/rateLimits";
import {
  DEFAULT_MESSAGES,
  type MediaErrorCode,
  redactError,
} from "../providers/errors";
import {
  type MediaOwner,
  ownerProjectId,
  ownerProvider,
  ownerUploadLimit,
  ownerUserId,
} from "./_lib/owner";
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
import { resolveProvider, tryResolveProvider } from "./providerResolution";

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
): Promise<MediaOwner> {
  const owned = await ctx.runQuery(internal.media.uploadsDb._findOwnedProject, {
    tokenIdentifier: user.tokenIdentifier,
    projectId,
  });
  if (!owned) throw new Error("Unauthorized");
  return { kind: "project", project: owned.project };
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

type UploadFile = {
  bytes: ArrayBuffer;
  mime: string;
  filename: string;
};

const uploadResultValidator = v.object({
  mediaId: v.id("media"),
  url: v.string(),
  provider: mediaProviderValidator,
  externalId: v.string(),
});

export type UploadResult = typeof uploadResultValidator.type;

export const upload = action({
  args: {
    projectId: v.id("projects"),
    bytes: v.bytes(),
    mime: v.string(),
    filename: v.string(),
    documentId: v.optional(v.id("documents")),
    provider: v.optional(mediaProviderValidator),
  },
  returns: uploadResultValidator,
  handler: async (ctx, args) =>
    await uploadForUser(ctx, await requireUserFromAuth(ctx), args),
});

export const uploadToNote = action({
  args: {
    noteId: v.id("notes"),
    bytes: v.bytes(),
    mime: v.string(),
    filename: v.string(),
  },
  returns: uploadResultValidator,
  handler: async (ctx, args) =>
    await uploadNoteForUser(ctx, await requireUserFromAuth(ctx), args),
});

export async function uploadForUser(
  ctx: ActionCtx,
  user: Doc<"users">,
  args: UploadFile & {
    projectId: Id<"projects">;
    documentId?: Id<"documents">;
    provider?: MediaProvider;
  },
): Promise<UploadResult> {
  const filename = await admitUpload(ctx, user, args);
  return await storeForOwner(
    ctx,
    await requireOwnedProject(ctx, user, args.projectId),
    { ...args, filename },
    {
      rateKey: user.tokenIdentifier,
      requested: args.provider,
      documentId: args.documentId,
    },
  );
}

export async function uploadNoteForUser(
  ctx: ActionCtx,
  user: Doc<"users">,
  args: UploadFile & { noteId: Id<"notes"> },
): Promise<UploadResult> {
  const filename = await admitUpload(ctx, user, args);
  const resolved = await ctx.runQuery(
    internal.media.uploadsDb._noteMediaOwner,
    { userId: user._id, noteId: args.noteId, requireNote: true },
  );
  if (!resolved.ok) {
    throw new ConvexError({
      code: "AUTH_INVALID" as MediaErrorCode,
      message: resolved.reason,
    });
  }
  return await storeForOwner(
    ctx,
    resolved.owner,
    { ...args, filename },
    { rateKey: user.tokenIdentifier },
  );
}

async function admitUpload(
  ctx: ActionCtx,
  user: Doc<"users">,
  file: UploadFile,
): Promise<string> {
  const key = user.tokenIdentifier;

  if (file.bytes.byteLength > QUOTAS.MAX_UPLOAD_BYTES) {
    throw new ConvexError({
      code: "FILE_TOO_LARGE" as MediaErrorCode,
      message: DEFAULT_MESSAGES.FILE_TOO_LARGE,
    });
  }
  if (!isAllowedMime(file.mime)) {
    throw new ConvexError({
      code: "UNSUPPORTED_MIME" as MediaErrorCode,
      message: DEFAULT_MESSAGES.UNSUPPORTED_MIME,
    });
  }

  const safeFilename = sanitizeFilename(file.filename);

  await rateLimiter.limit(ctx, "media:upload", { key, throws: true });
  await rateLimiter.limit(ctx, "media:uploadConcurrency", {
    key,
    throws: true,
  });
  await rateLimiter.limit(ctx, "media:globalUpload", {
    key: "global",
    throws: true,
  });
  return safeFilename;
}

async function storeForOwner(
  ctx: ActionCtx,
  owner: MediaOwner,
  file: UploadFile,
  opts: {
    rateKey: string;
    requested?: MediaProvider | undefined;
    documentId?: Id<"documents"> | undefined;
  },
): Promise<UploadResult> {
  if (file.bytes.byteLength > ownerUploadLimit(owner)) {
    throw new ConvexError({
      code: "FILE_TOO_LARGE" as MediaErrorCode,
      message: DEFAULT_MESSAGES.FILE_TOO_LARGE,
    });
  }

  const userId = ownerUserId(owner);
  const projectId = ownerProjectId(owner);
  const provider = ownerProvider(owner, opts.requested);

  const quota = await ctx.runQuery(internal.media.uploadsDb._quotaCheck, {
    userId,
    incomingBytes: file.bytes.byteLength,
    ...(projectId !== undefined ? { projectId } : {}),
  });
  if (!quota.ok) {
    await logError(
      ctx,
      { owner, provider },
      "upload",
      "PROJECT_QUOTA",
      `Hit ${quota.reason} quota`,
    );
    throw new ConvexError({
      code: "PROJECT_QUOTA" as MediaErrorCode,
      message: DEFAULT_MESSAGES.PROJECT_QUOTA,
    });
  }

  try {
    const { adapter, cx } = await resolveProvider(ctx, {
      owner,
      requested: opts.requested,
      rateKey: opts.rateKey,
      requireValid: true,
    });

    const res = await adapter.upload(cx, {
      buffer: Buffer.from(new Uint8Array(file.bytes)),
      mime: file.mime,
      filename: file.filename,
    });

    const recorded: Id<"media"> | null = await ctx.runMutation(
      internal.media.uploadsDb._recordUpload,
      {
        userId,
        provider,
        externalId: res.externalId,
        url: res.url,
        filename: file.filename,
        mime: file.mime,
        bytes: res.bytes,
        ...(projectId !== undefined ? { projectId } : {}),
        ...(owner.kind === "user" ? { noteId: owner.noteId } : {}),
        ...(owner.kind === "user" && owner.source.projectId !== undefined
          ? { sourceProjectId: owner.source.projectId }
          : {}),
        ...(res.width !== undefined ? { width: res.width } : {}),
        ...(res.height !== undefined ? { height: res.height } : {}),
        ...(opts.documentId !== undefined
          ? { documentId: opts.documentId }
          : {}),
      },
    );

    if (recorded === null) {
      throw new ConvexError({
        code: "UNKNOWN" satisfies MediaErrorCode,
        message: "The note was deleted during the upload.",
      });
    }
    return {
      mediaId: recorded,
      url: res.url,
      provider,
      externalId: res.externalId,
    };
  } catch (err) {
    throw await normalizeFailure(
      ctx,
      err,
      { owner, provider },
      "upload",
      "Upload failed",
    );
  }
}

export const _deleteNoteObjects = internalAction({
  args: {
    userId: v.id("users"),
    noteId: v.id("notes"),
    refs: v.array(
      v.object({
        provider: mediaProviderValidator,
        externalId: v.string(),
        sourceProjectId: v.optional(v.id("projects")),
      }),
    ),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const bySource = new Map<string, typeof args.refs>();
    for (const ref of args.refs) {
      const key = `${ref.sourceProjectId ?? "own"}:${ref.provider}`;
      bySource.set(key, [...(bySource.get(key) ?? []), ref]);
    }

    for (const refs of bySource.values()) {
      const first = refs[0];
      if (!first || first.provider === "github") continue;
      const resolved = await ctx.runQuery(
        internal.media.uploadsDb._noteMediaOwner,
        {
          userId: args.userId,
          noteId: args.noteId,
          requireNote: false,
          source:
            first.sourceProjectId === undefined
              ? { kind: "own", provider: first.provider }
              : { kind: "project", projectId: first.sourceProjectId },
        },
      );
      if (!resolved.ok) continue;
      const { owner } = resolved;
      if (owner.source.provider !== first.provider) continue;
      const target = await tryResolveProvider(ctx, {
        owner,
        rateKey: `notes:${args.userId}`,
      });
      if (!target) continue;

      for (const ref of refs) {
        try {
          await target.adapter.remove(target.cx, {
            externalId: ref.externalId,
          });
        } catch (err) {
          await normalizeFailure(
            ctx,
            err,
            { owner, provider: target.provider },
            "delete",
            "Delete failed",
          );
        }
      }
    }
    return null;
  },
});

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

  const owner = await requireOwnedProject(ctx, user, args.projectId);
  const provider = ownerProvider(owner, args.provider);

  try {
    const resolved = await tryResolveProvider(ctx, {
      owner,
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
      { owner, provider },
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

    const owner = await requireOwnedProject(ctx, user, args.projectId);

    try {
      const { adapter, cx } = await resolveProvider(ctx, {
        owner,
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
        { owner, provider: args.provider },
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

type FailureSite = { owner: MediaOwner; provider: MediaProvider };

async function normalizeFailure(
  ctx: ActionCtx,
  err: unknown,
  where: FailureSite,
  operation: "upload" | "list" | "delete",
  fallbackMessage: string,
): Promise<unknown> {
  if (err instanceof ConvexError) {
    const data = err.data as { code?: string; message?: string };
    await logError(
      ctx,
      where,
      operation,
      data?.code ?? "UNKNOWN",
      data?.message ?? fallbackMessage,
      redactError(err),
    );
    return err;
  }
  await logError(
    ctx,
    where,
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
  where: FailureSite,
  operation: string,
  errorCode: string,
  errorMessage: string,
  providerError?: string,
): Promise<void> {
  const projectId = ownerProjectId(where.owner);
  try {
    await ctx.runMutation(internal.media.uploadsDb._logError, {
      userId: ownerUserId(where.owner),
      provider: where.provider,
      operation,
      errorCode,
      errorMessage,
      ...(projectId !== undefined ? { projectId } : {}),
      ...(providerError !== undefined ? { providerError } : {}),
    });
  } catch {}
}
