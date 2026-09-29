"use node";

import { v } from "convex/values";
import { mcpCallerValidator } from "convex-mcp-gateway";
import { internal } from "../../_generated/api";
import type { Doc, Id } from "../../_generated/dataModel";
import type { ActionCtx } from "../../_generated/server";
import { requireCallerInAction } from "../../_lib/auth";
import { mediaMarkdown } from "../../media/_lib/remote";
import {
  listMediaForUser,
  loadMediaSource,
  type MediaSource,
  uploadForUser,
} from "../../media/uploads";
import { uniqueObjectKey } from "../../providers/shared";
import { agentAction } from "../agentFunctions";

async function uploadToProvider(
  ctx: ActionCtx,
  user: Doc<"users">,
  args: {
    projectId: Id<"projects">;
    bytes: ArrayBuffer;
    mime: string;
    filename: string;
    alt?: string | undefined;
    documentId?: Id<"documents"> | undefined;
  },
) {
  const result = await uploadForUser(ctx, user, {
    projectId: args.projectId,
    bytes: args.bytes,
    mime: args.mime,
    filename: uniqueObjectKey("", args.filename),
    ...(args.documentId !== undefined ? { documentId: args.documentId } : {}),
  });
  return {
    ...result,
    markdown: mediaMarkdown(args.mime, result.url, args.alt),
  };
}

type ProviderUpload = Awaited<ReturnType<typeof uploadToProvider>>;

export const mediaList = agentAction({
  args: {
    caller: mcpCallerValidator,
    projectId: v.id("projects"),
    cursor: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await requireCallerInAction(ctx, args.caller);
    const { caller: _caller, ...rest } = args;
    return await listMediaForUser(ctx, user, rest);
  },
});

function pickSource(args: {
  sourceUrl?: string;
  base64?: string;
}): MediaSource {
  if ((args.sourceUrl === undefined) === (args.base64 === undefined)) {
    throw new Error(
      "Pass exactly one of sourceUrl or base64. For a file on disk, use wryte_media_upload_url.",
    );
  }
  return args.sourceUrl !== undefined
    ? { kind: "url", url: args.sourceUrl }
    : { kind: "base64", base64: args.base64 ?? "" };
}

export const mediaUpload = agentAction({
  args: {
    caller: mcpCallerValidator,
    projectId: v.id("projects"),
    sourceUrl: v.optional(v.string()),
    base64: v.optional(v.string()),
    filename: v.optional(v.string()),
    mime: v.optional(v.string()),
    alt: v.optional(v.string()),
    documentId: v.optional(v.id("documents")),
  },
  handler: async (ctx, args): Promise<ProviderUpload> => {
    const user = await requireCallerInAction(ctx, args.caller);
    const loaded = await loadMediaSource(pickSource(args));

    const mime = args.mime ?? loaded.mime;
    const filename = args.filename ?? loaded.filename;
    if (!mime || !filename) {
      throw new Error("Pass mime and filename with base64.");
    }

    return await uploadToProvider(ctx, user, {
      projectId: args.projectId,
      bytes: loaded.bytes,
      mime,
      filename,
      alt: args.alt,
      documentId: args.documentId,
    });
  },
});

export const uploadFromTicket = agentAction({
  args: {
    userId: v.id("users"),
    projectId: v.id("projects"),
    bytes: v.bytes(),
    mime: v.string(),
    filename: v.string(),
    alt: v.optional(v.string()),
    documentId: v.optional(v.id("documents")),
  },
  handler: async (ctx, args): Promise<ProviderUpload> => {
    const user: Doc<"users"> | null = await ctx.runQuery(
      internal.account.users.internalGet,
      {
        userId: args.userId,
      },
    );
    if (!user) throw new Error("User not found");
    const { userId: _userId, ...rest } = args;
    return await uploadToProvider(ctx, user, rest);
  },
});
