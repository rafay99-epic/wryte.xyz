/**
 * Non-Node helpers for media records and usage counters.
 *
 * The public `media` actions in `convex/media/uploads.ts` (Node-only) call
 * into these helpers via `ctx.runQuery` / `ctx.runMutation`.
 */
import { v } from "convex/values";
import type { Id } from "../_generated/dataModel";
import { internalMutation, internalQuery, query } from "../_generated/server";
import { getAuthedUserOrNull } from "../_lib/auth";
import { currentMonthBucket, QUOTAS } from "../_lib/quotas";

const PROVIDER_VALIDATOR = v.union(
  v.literal("github"),
  v.literal("uploadthing"),
  v.literal("cloudinary"),
);

/* ------------------------------------------------------------------ */
/*  Public queries                                                      */
/* ------------------------------------------------------------------ */

/**
 * Paginated media list for the project's media library. Caller passes a
 * cursor (the previous page's last row's `createdAt`) and a page size.
 */
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
      .withIndex("by_projectId_and_createdAt", (qb) =>
        qb.eq("projectId", args.projectId),
      )
      .order("desc");
    const rows = await q.take(size + 1);
    const hasMore = rows.length > size;
    const items = hasMore ? rows.slice(0, size) : rows;
    const last = items[items.length - 1];
    const nextCursor = hasMore && last ? last.createdAt : null;
    return { items, nextCursor };
  },
});

export const getUsage = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    const user = await getAuthedUserOrNull(ctx);
    if (!user) return null;
    const project = await ctx.db.get(args.projectId);
    if (!project || project.userId !== user._id) return null;

    const usage = await ctx.db
      .query("mediaUsage")
      .withIndex("by_projectId", (q) => q.eq("projectId", args.projectId))
      .unique();
    return usage;
  },
});

/**
 * Count of legacy `convex_legacy` rows for this project — drives the
 * "Configure media storage to migrate N legacy images" banner.
 */
export const legacyCount = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    const user = await getAuthedUserOrNull(ctx);
    if (!user) return 0;
    const project = await ctx.db.get(args.projectId);
    if (!project || project.userId !== user._id) return 0;

    const rows = await ctx.db
      .query("media")
      .withIndex("by_projectId", (q) => q.eq("projectId", args.projectId))
      .collect();
    return rows.filter((r) => r.provider === "convex_legacy" || !!r.storageId)
      .length;
  },
});

/* ------------------------------------------------------------------ */
/*  Internal queries                                                    */
/* ------------------------------------------------------------------ */

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

export const _getById = internalQuery({
  args: { mediaId: v.id("media") },
  handler: async (ctx, args) => ctx.db.get(args.mediaId),
});

export const _findByProviderAndExternalId = internalQuery({
  args: {
    provider: v.union(
      v.literal("github"),
      v.literal("uploadthing"),
      v.literal("cloudinary"),
      v.literal("convex_legacy"),
    ),
    externalId: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("media")
      .withIndex("by_provider_and_externalId", (q) =>
        q.eq("provider", args.provider).eq("externalId", args.externalId),
      )
      .unique();
  },
});

export const _getCredential = internalQuery({
  args: {
    projectId: v.id("projects"),
    provider: v.union(v.literal("uploadthing"), v.literal("cloudinary")),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("mediaCredentials")
      .withIndex("by_projectId_and_provider", (q) =>
        q.eq("projectId", args.projectId).eq("provider", args.provider),
      )
      .unique();
  },
});

export const _readUsage = internalQuery({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("mediaUsage")
      .withIndex("by_projectId", (q) => q.eq("projectId", args.projectId))
      .unique();
  },
});

/* ------------------------------------------------------------------ */
/*  Internal mutations                                                  */
/* ------------------------------------------------------------------ */

/**
 * Records a successful upload: inserts the media row, bumps `mediaUsage`,
 * all in one mutation so counts and rows stay consistent.
 */
export const _recordUpload = internalMutation({
  args: {
    projectId: v.id("projects"),
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
  handler: async (ctx, args): Promise<Id<"media">> => {
    const now = Date.now();
    const insert: Record<string, unknown> = {
      projectId: args.projectId,
      userId: args.userId,
      provider: args.provider,
      externalId: args.externalId,
      url: args.url,
      filename: args.filename,
      mime: args.mime,
      bytes: args.bytes,
      createdAt: now,
    };
    if (args.width !== undefined) insert["width"] = args.width;
    if (args.height !== undefined) insert["height"] = args.height;
    if (args.documentId !== undefined) insert["documentId"] = args.documentId;
    const mediaId = (await ctx.db.insert(
      "media",
      insert as never,
    )) as Id<"media">;

    // Increment usage counter.
    const month = currentMonthBucket(now);
    const existing = await ctx.db
      .query("mediaUsage")
      .withIndex("by_projectId", (q) => q.eq("projectId", args.projectId))
      .unique();
    if (existing) {
      const sameMonth = existing.monthBucket === month;
      await ctx.db.patch(existing._id, {
        fileCount: existing.fileCount + 1,
        totalBytes: existing.totalBytes + args.bytes,
        uploadsThisMonth: sameMonth ? existing.uploadsThisMonth + 1 : 1,
        monthBucket: month,
        updatedAt: now,
      });
    } else {
      await ctx.db.insert("mediaUsage", {
        projectId: args.projectId,
        userId: args.userId,
        fileCount: 1,
        totalBytes: args.bytes,
        uploadsThisMonth: 1,
        monthBucket: month,
        updatedAt: now,
      });
    }

    return mediaId;
  },
});

/**
 * Removes a media row and decrements `mediaUsage`. The provider-side delete
 * has already happened in the calling action.
 */
export const _deleteRow = internalMutation({
  args: { mediaId: v.id("media") },
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.mediaId);
    if (!row) return;
    await ctx.db.delete(args.mediaId);

    const usage = await ctx.db
      .query("mediaUsage")
      .withIndex("by_projectId", (q) => q.eq("projectId", row.projectId))
      .unique();
    if (usage) {
      const bytes = row.bytes ?? row.size ?? 0;
      await ctx.db.patch(usage._id, {
        fileCount: Math.max(0, usage.fileCount - 1),
        totalBytes: Math.max(0, usage.totalBytes - bytes),
        updatedAt: Date.now(),
      });
    }
  },
});

/**
 * Logs a normalized media error. Best-effort — never throws so the caller's
 * own error path is preserved.
 */
export const _logError = internalMutation({
  args: {
    projectId: v.id("projects"),
    userId: v.id("users"),
    provider: v.string(),
    operation: v.string(),
    errorCode: v.string(),
    errorMessage: v.string(),
    providerError: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const insert: Record<string, unknown> = {
      projectId: args.projectId,
      userId: args.userId,
      provider: args.provider,
      operation: args.operation,
      errorCode: args.errorCode,
      errorMessage: args.errorMessage,
      createdAt: Date.now(),
    };
    if (args.providerError !== undefined) {
      insert["providerError"] = args.providerError;
    }
    await ctx.db.insert("mediaErrorLog", insert as never);
  },
});

/**
 * Quota check helper for actions. Read-only; returns a typed verdict.
 */
export const _quotaCheck = internalQuery({
  args: {
    projectId: v.id("projects"),
    incomingBytes: v.number(),
  },
  handler: async (ctx, args) => {
    const usage = await ctx.db
      .query("mediaUsage")
      .withIndex("by_projectId", (q) => q.eq("projectId", args.projectId))
      .unique();
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

/**
 * Cron helper: prune `mediaErrorLog` rows older than `cutoffMs`.
 */
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
