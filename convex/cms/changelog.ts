/**
 * Changelog functions — public release notes.
 *
 * Reads are public (no auth required) so the marketing site can render
 * them server-side via `fetchQuery` and stream them into the public
 * changelog page. Writes are gated behind `publicMetadata.role ===
 * "admin"` in Clerk (see `convex/_lib/admin.ts`) and rate-limited per
 * acting admin to protect against runaway scripts.
 *
 * Slugs are derived from the title (see `generateSlug` in
 * `src/lib/markdown.ts`) and must be unique across all entries —
 * enforced by the `by_slug` index plus an explicit conflict check on
 * create/update.
 */
import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import {
  action,
  internalMutation,
  internalQuery,
  query,
} from "../_generated/server";
import { requireAdmin } from "../_lib/admin";
import { getRateLimitKey, rateLimiter } from "../_lib/rateLimits";

/* ------------------------------------------------------------------ */
/*  Public reads                                                       */
/* ------------------------------------------------------------------ */

/**
 * Paginated published changelog entries in reverse-chronological order.
 * Public — powers the marketing `/changelog` page with cursor-based
 * pagination so the page stays fast as the list grows.
 */
export const listPublished = query({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("changelog")
      .withIndex("by_publishedAt", (q) => q.gt("publishedAt", 0))
      .order("desc")
      .paginate(args.paginationOpts);
  },
});

/**
 * Lightweight feed of published entries for the RSS route.
 * Returns only the fields needed for XML generation, bounded to 50.
 */
export const listForFeed = query({
  args: {},
  handler: async (ctx) => {
    const entries = await ctx.db
      .query("changelog")
      .withIndex("by_publishedAt", (q) => q.gt("publishedAt", 0))
      .order("desc")
      .take(50);

    return entries.map((e) => ({
      slug: e.slug,
      title: e.title,
      description: e.description,
      publishedAt: e.publishedAt,
    }));
  },
});

/**
 * Fetches a single entry by id for the admin editor. Admin-gated
 * because it returns drafts (unpublished entries) too.
 */
export const getByIdForAdmin = action({
  args: { id: v.id("changelog") },
  handler: async (
    ctx,
    args,
  ): Promise<{
    _id: Id<"changelog">;
    title: string;
    slug: string;
    description: string;
    content: string;
    version?: string;
    build: string;
    publishedAt?: number;
    authorClerkUserId: string;
    createdAt: number;
    updatedAt: number;
  } | null> => {
    await requireAdmin(ctx);
    return await ctx.runQuery(internal.cms.changelog._getByIdInternal, {
      id: args.id,
    });
  },
});

export const _getByIdInternal = internalQuery({
  args: { id: v.id("changelog") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

/** Fetches a single published entry by slug, or null if not found / unpublished. */
export const getBySlug = query({
  args: { slug: v.string() },
  handler: async (ctx, args) => {
    const entry = await ctx.db
      .query("changelog")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .unique();
    if (!entry || entry.publishedAt === undefined) return null;
    return entry;
  },
});

/* ------------------------------------------------------------------ */
/*  Admin reads — listing drafts too                                   */
/* ------------------------------------------------------------------ */

/**
 * Lists every changelog entry (drafts + published) for the admin UI.
 * Sorted by `_creationTime` descending so newest drafts surface first.
 */
export const listAllForAdmin = action({
  args: {},
  handler: async (
    ctx,
  ): Promise<
    Array<{
      _id: Id<"changelog">;
      _creationTime: number;
      title: string;
      slug: string;
      description: string;
      content: string;
      version?: string;
      build: string;
      publishedAt?: number;
      authorClerkUserId: string;
      createdAt: number;
      updatedAt: number;
    }>
  > => {
    await requireAdmin(ctx);
    return await ctx.runQuery(internal.cms.changelog._listAllInternal, {});
  },
});

export const _listAllInternal = internalQuery({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("changelog").order("desc").take(200);
  },
});

/* ------------------------------------------------------------------ */
/*  Admin writes                                                       */
/* ------------------------------------------------------------------ */

export const create = action({
  args: {
    title: v.string(),
    slug: v.string(),
    description: v.string(),
    content: v.string(),
    version: v.optional(v.string()),
    build: v.string(),
    publish: v.boolean(),
  },
  handler: async (ctx, args): Promise<Id<"changelog">> => {
    const key = await getRateLimitKey(ctx);
    await rateLimiter.limit(ctx, "changelog:create", { key, throws: true });

    const clerkUserId = await requireAdmin(ctx);
    return await ctx.runMutation(internal.cms.changelog._create, {
      ...args,
      authorClerkUserId: clerkUserId,
    });
  },
});

export const update = action({
  args: {
    id: v.id("changelog"),
    title: v.string(),
    slug: v.string(),
    description: v.string(),
    content: v.string(),
    version: v.optional(v.string()),
    build: v.string(),
    publish: v.boolean(),
  },
  handler: async (ctx, args): Promise<null> => {
    const key = await getRateLimitKey(ctx);
    await rateLimiter.limit(ctx, "changelog:update", { key, throws: true });

    await requireAdmin(ctx);
    await ctx.runMutation(internal.cms.changelog._update, args);
    return null;
  },
});

export const remove = action({
  args: { id: v.id("changelog") },
  handler: async (ctx, args): Promise<null> => {
    const key = await getRateLimitKey(ctx);
    await rateLimiter.limit(ctx, "changelog:remove", { key, throws: true });

    await requireAdmin(ctx);
    await ctx.runMutation(internal.cms.changelog._delete, args);
    return null;
  },
});

/* ------------------------------------------------------------------ */
/*  Internal mutations — DB writes                                     */
/* ------------------------------------------------------------------ */

export const _create = internalMutation({
  args: {
    title: v.string(),
    slug: v.string(),
    description: v.string(),
    content: v.string(),
    version: v.optional(v.string()),
    build: v.string(),
    publish: v.boolean(),
    authorClerkUserId: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("changelog")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .unique();
    if (existing) {
      throw new Error(
        `A changelog entry with slug "${args.slug}" already exists.`,
      );
    }
    const now = Date.now();
    return await ctx.db.insert("changelog", {
      title: args.title,
      slug: args.slug,
      description: args.description,
      content: args.content,
      build: args.build,
      authorClerkUserId: args.authorClerkUserId,
      createdAt: now,
      updatedAt: now,
      // Optional milestone label — omit the field entirely when blank.
      ...(args.version ? { version: args.version } : {}),
      ...(args.publish ? { publishedAt: now } : {}),
    });
  },
});

export const _update = internalMutation({
  args: {
    id: v.id("changelog"),
    title: v.string(),
    slug: v.string(),
    description: v.string(),
    content: v.string(),
    version: v.optional(v.string()),
    build: v.string(),
    publish: v.boolean(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db.get(args.id);
    if (!existing) throw new Error("Changelog entry not found.");

    if (args.slug !== existing.slug) {
      const slugConflict = await ctx.db
        .query("changelog")
        .withIndex("by_slug", (q) => q.eq("slug", args.slug))
        .unique();
      if (slugConflict && slugConflict._id !== args.id) {
        throw new Error(
          `A changelog entry with slug "${args.slug}" already exists.`,
        );
      }
    }

    const now = Date.now();
    await ctx.db.patch(args.id, {
      title: args.title,
      slug: args.slug,
      description: args.description,
      content: args.content,
      version: args.version,
      build: args.build,
      updatedAt: now,
      // `ctx.db.patch` treats `undefined` as "clear this field", which is
      // exactly what we want when transitioning published → draft.
      publishedAt: args.publish ? (existing.publishedAt ?? now) : undefined,
    });
  },
});

export const _delete = internalMutation({
  args: { id: v.id("changelog") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
  },
});
