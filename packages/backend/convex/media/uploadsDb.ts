import { v } from "convex/values";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { internalMutation, internalQuery, query } from "../_generated/server";
import { getAuthedUserOrNull } from "../_lib/auth";
import { currentMonthBucket, QUOTAS } from "../_lib/quotas";
import {
  findCredential,
  loadNoteSettings,
  noteMediaSettingValidator,
  resolveNoteSource,
} from "./_lib/noteSource";
import { isUsableCredential, type MediaOwner } from "./_lib/owner";
import {
  credentialProviderValidator,
  mediaProviderValidator,
} from "./_lib/providers";
import { adjustUsage, findUsage } from "./_lib/usage";

const PROVIDER_VALIDATOR = mediaProviderValidator;

export const listForProject = query({
  args: {
    projectId: v.id("projects"),
    cursor: v.optional(v.number()),
    pageSize: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await getAuthedUserOrNull(ctx);
    if (!user) return { items: [], nextCursor: null as number | null };
    const project = await ctx.db.get(args.projectId);
    if (!project || project.userId !== user._id) {
      return { items: [], nextCursor: null as number | null };
    }

    const size = Math.min(args.pageSize ?? 50, 100);
    const q = ctx.db
      .query("media")
      .withIndex("by_projectId_and_createdAt", (qb) => {
        const idx = qb.eq("projectId", args.projectId);
        return args.cursor !== undefined
          ? idx.lt("createdAt", args.cursor)
          : idx;
      })
      .order("desc");
    const rows = await q.take(size + 1);
    const hasMore = rows.length > size;
    const items = hasMore ? rows.slice(0, size) : rows;
    const last = items[items.length - 1];
    const nextCursor = hasMore && last ? last.createdAt : null;
    return { items, nextCursor };
  },
});

export const _findOwnedProject = internalQuery({
  args: {
    tokenIdentifier: v.string(),
    projectId: v.id("projects"),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_tokenIdentifier", (q) =>
        q.eq("tokenIdentifier", args.tokenIdentifier),
      )
      .unique();
    if (!user) return null;
    const project = await ctx.db.get(args.projectId);
    if (!project || project.userId !== user._id) return null;
    return { project, userId: user._id };
  },
});

export const _findByProviderAndExternalId = internalQuery({
  args: {
    projectId: v.id("projects"),
    provider: PROVIDER_VALIDATOR,
    externalId: v.string(),
  },
  handler: async (ctx, args) => {
    const matches = await ctx.db
      .query("media")
      .withIndex("by_provider_and_externalId", (q) =>
        q.eq("provider", args.provider).eq("externalId", args.externalId),
      )
      .take(10);
    return matches.find((m) => m.projectId === args.projectId) ?? null;
  },
});

export const _getCredential = internalQuery({
  args: {
    userId: v.id("users"),
    projectId: v.optional(v.id("projects")),
    provider: credentialProviderValidator,
  },
  handler: async (ctx, args) =>
    await findCredential(
      ctx,
      { userId: args.userId, projectId: args.projectId },
      args.provider,
    ),
});

export const _noteMediaOwner = internalQuery({
  args: {
    userId: v.id("users"),
    noteId: v.id("notes"),
    requireNote: v.boolean(),
    source: v.optional(noteMediaSettingValidator),
  },
  handler: async (
    ctx,
    args,
  ): Promise<
    | { ok: true; owner: Extract<MediaOwner, { kind: "user" }> }
    | { ok: false; reason: string }
  > => {
    if (args.requireNote) {
      const note = await ctx.db.get(args.noteId);
      if (
        !note ||
        note.userId !== args.userId ||
        note.trashedAt !== undefined
      ) {
        throw new Error("Note not found");
      }
    }
    const settings = await loadNoteSettings(ctx, args.userId);
    const decision = await resolveNoteSource(
      ctx,
      args.userId,
      args.source ?? settings?.media,
      isUsableCredential,
    );
    if (!decision.ok) return decision;
    return {
      ok: true,
      owner: {
        kind: "user",
        userId: args.userId,
        noteId: args.noteId,
        mediaPath: settings?.mediaPath ?? "",
        source: decision.source,
      },
    };
  },
});

export const _recordUpload = internalMutation({
  args: {
    projectId: v.optional(v.id("projects")),
    noteId: v.optional(v.id("notes")),
    sourceProjectId: v.optional(v.id("projects")),
    userId: v.id("users"),
    provider: PROVIDER_VALIDATOR,
    externalId: v.string(),
    url: v.string(),
    filename: v.string(),
    mime: v.string(),
    bytes: v.number(),
    width: v.optional(v.number()),
    height: v.optional(v.number()),
    documentId: v.optional(v.id("documents")),
  },
  handler: async (ctx, args): Promise<Id<"media"> | null> => {
    if (args.noteId !== undefined) {
      const note = await ctx.db.get(args.noteId);
      if (!note || note.userId !== args.userId) {
        await ctx.scheduler.runAfter(
          0,
          internal.media.uploads._deleteNoteObjects,
          {
            userId: args.userId,
            noteId: args.noteId,
            refs: [
              {
                provider: args.provider,
                externalId: args.externalId,
                ...(args.sourceProjectId !== undefined
                  ? { sourceProjectId: args.sourceProjectId }
                  : {}),
              },
            ],
          },
        );
        return null;
      }
    }
    const mediaId = await ctx.db.insert("media", {
      ...args,
      createdAt: Date.now(),
    });
    await adjustUsage(
      ctx,
      { userId: args.userId, projectId: args.projectId },
      { files: 1, bytes: args.bytes, uploads: 1 },
    );
    return mediaId;
  },
});

export const _deleteRow = internalMutation({
  args: { mediaId: v.id("media") },
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.mediaId);
    if (!row) return;
    await ctx.db.delete(args.mediaId);
    await adjustUsage(
      ctx,
      { userId: row.userId, projectId: row.projectId },
      { files: -1, bytes: -(row.bytes ?? 0), uploads: 0 },
    );
  },
});

export const _logError = internalMutation({
  args: {
    projectId: v.optional(v.id("projects")),
    userId: v.id("users"),
    provider: v.string(),
    operation: v.string(),
    errorCode: v.string(),
    errorMessage: v.string(),
    providerError: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("mediaErrorLog", { ...args, createdAt: Date.now() });
  },
});

export const _quotaCheck = internalQuery({
  args: {
    userId: v.id("users"),
    projectId: v.optional(v.id("projects")),
    incomingBytes: v.number(),
  },
  handler: async (ctx, args) => {
    const usage = await findUsage(ctx, {
      userId: args.userId,
      projectId: args.projectId,
    });
    const fileCount = usage?.fileCount ?? 0;
    const totalBytes = usage?.totalBytes ?? 0;
    const uploadsThisMonth = usage?.uploadsThisMonth ?? 0;
    const monthBucket = usage?.monthBucket ?? currentMonthBucket();
    const isCurrentMonth = monthBucket === currentMonthBucket();
    const effectiveMonthlyCount = isCurrentMonth ? uploadsThisMonth : 0;

    if (fileCount + 1 > QUOTAS.MAX_FILES_PER_PROJECT) {
      return { ok: false, reason: "files" as const };
    }
    if (totalBytes + args.incomingBytes > QUOTAS.MAX_BYTES_PER_PROJECT) {
      return { ok: false, reason: "bytes" as const };
    }
    if (effectiveMonthlyCount + 1 > QUOTAS.MAX_UPLOADS_PER_MONTH_PER_USER) {
      return { ok: false, reason: "monthly" as const };
    }
    return { ok: true as const };
  },
});

export const _pruneErrorLog = internalMutation({
  args: { cutoffMs: v.number(), batchSize: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const batch = args.batchSize ?? 200;
    const rows = await ctx.db.query("mediaErrorLog").take(batch);
    let removed = 0;
    for (const r of rows) {
      if (r.createdAt < args.cutoffMs) {
        await ctx.db.delete(r._id);
        removed++;
      }
    }
    return removed;
  },
});
