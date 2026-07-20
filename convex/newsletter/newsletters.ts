/**
 * Newsletter documents — the standalone composer's CRUD. A newsletter is
 * subject + markdown body with a send lifecycle; it never touches GitHub.
 * Sending lives in `send.ts`.
 */

import { ConvexError, v } from "convex/values";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { internalMutation, mutation, query } from "../_generated/server";
import { getAuthedUserOrNull, getCurrentUser } from "../_lib/auth";
import { getRateLimitKey, rateLimiter } from "../_lib/rateLimits";

const STATUS = v.union(
  v.literal("draft"),
  v.literal("scheduled"),
  v.literal("sent"),
  v.literal("failed"),
);

/** Client-generated slug (mirrors cms/shareLinks token convention). */
const SLUG_RE = /^[a-z0-9-]{6,64}$/;

const LIST_ITEM = v.object({
  _id: v.id("newsletters"),
  slug: v.string(),
  subject: v.string(),
  status: STATUS,
  scheduledAt: v.optional(v.number()),
  sentAt: v.optional(v.number()),
  recipientCount: v.optional(v.number()),
  remoteUrl: v.optional(v.string()),
  errorMessage: v.optional(v.string()),
  updatedAt: v.number(),
});

const DETAIL = v.object({
  _id: v.id("newsletters"),
  slug: v.string(),
  projectId: v.id("projects"),
  subject: v.string(),
  bodyMarkdown: v.string(),
  previewText: v.optional(v.string()),
  fromName: v.optional(v.string()),
  internalNote: v.optional(v.string()),
  status: STATUS,
  listId: v.optional(v.string()),
  scheduledAt: v.optional(v.number()),
  sentAt: v.optional(v.number()),
  recipientCount: v.optional(v.number()),
  remoteUrl: v.optional(v.string()),
  errorMessage: v.optional(v.string()),
  sourceDocumentId: v.optional(v.id("documents")),
});

type NewsletterDoc = {
  _id: Id<"newsletters">;
  slug: string;
  projectId: Id<"projects">;
  subject: string;
  bodyMarkdown: string;
  previewText?: string;
  fromName?: string;
  internalNote?: string;
  status: "draft" | "scheduled" | "sent" | "failed";
  listId?: string;
  scheduledAt?: number;
  sentAt?: number;
  recipientCount?: number;
  remoteUrl?: string;
  errorMessage?: string;
  sourceDocumentId?: Id<"documents">;
};

function toDetail(n: {
  _id: Id<"newsletters">;
  slug?: string;
  projectId: Id<"projects">;
  subject: string;
  bodyMarkdown: string;
  previewText?: string;
  fromName?: string;
  internalNote?: string;
  status: "draft" | "scheduled" | "sent" | "failed";
  listId?: string;
  scheduledAt?: number;
  sentAt?: number;
  recipientCount?: number;
  remoteUrl?: string;
  errorMessage?: string;
  sourceDocumentId?: Id<"documents">;
}): NewsletterDoc {
  return {
    _id: n._id,
    slug: n.slug ?? "",
    projectId: n.projectId,
    subject: n.subject,
    bodyMarkdown: n.bodyMarkdown,
    ...(n.previewText !== undefined ? { previewText: n.previewText } : {}),
    ...(n.fromName !== undefined ? { fromName: n.fromName } : {}),
    ...(n.internalNote !== undefined ? { internalNote: n.internalNote } : {}),
    status: n.status,
    ...(n.listId !== undefined ? { listId: n.listId } : {}),
    ...(n.scheduledAt !== undefined ? { scheduledAt: n.scheduledAt } : {}),
    ...(n.sentAt !== undefined ? { sentAt: n.sentAt } : {}),
    ...(n.recipientCount !== undefined
      ? { recipientCount: n.recipientCount }
      : {}),
    ...(n.remoteUrl !== undefined ? { remoteUrl: n.remoteUrl } : {}),
    ...(n.errorMessage !== undefined ? { errorMessage: n.errorMessage } : {}),
    ...(n.sourceDocumentId !== undefined
      ? { sourceDocumentId: n.sourceDocumentId }
      : {}),
  };
}

async function assertOwnsProject(
  ctx: Pick<MutationCtx, "db">,
  projectId: Id<"projects">,
  userId: Id<"users">,
): Promise<void> {
  const project = await ctx.db.get(projectId);
  if (!project || project.userId !== userId) {
    throw new ConvexError({ message: "Unauthorized" });
  }
}

/** Newsletters for a project, newest first — for the list view. */
export const list = query({
  args: { projectId: v.id("projects") },
  returns: v.array(LIST_ITEM),
  handler: async (ctx, args) => {
    const user = await getAuthedUserOrNull(ctx);
    if (!user) return [];
    const project = await ctx.db.get(args.projectId);
    if (!project || project.userId !== user._id) return [];

    const rows = await ctx.db
      .query("newsletters")
      .withIndex("by_projectId", (q) => q.eq("projectId", args.projectId))
      .order("desc")
      .take(100);
    return rows.map((n) => ({
      _id: n._id,
      slug: n.slug ?? "",
      subject: n.subject,
      status: n.status,
      ...(n.scheduledAt !== undefined ? { scheduledAt: n.scheduledAt } : {}),
      ...(n.sentAt !== undefined ? { sentAt: n.sentAt } : {}),
      ...(n.recipientCount !== undefined
        ? { recipientCount: n.recipientCount }
        : {}),
      ...(n.remoteUrl !== undefined ? { remoteUrl: n.remoteUrl } : {}),
      ...(n.errorMessage !== undefined ? { errorMessage: n.errorMessage } : {}),
      updatedAt: n.updatedAt,
    }));
  },
});

/** Counts for the overview stat strip. */
export const counts = query({
  args: { projectId: v.id("projects") },
  returns: v.object({
    draft: v.number(),
    scheduled: v.number(),
    sent: v.number(),
    failed: v.number(),
  }),
  handler: async (ctx, args) => {
    const empty = { draft: 0, scheduled: 0, sent: 0, failed: 0 };
    const user = await getAuthedUserOrNull(ctx);
    if (!user) return empty;
    const project = await ctx.db.get(args.projectId);
    if (!project || project.userId !== user._id) return empty;

    const rows = await ctx.db
      .query("newsletters")
      .withIndex("by_projectId", (q) => q.eq("projectId", args.projectId))
      .take(500);
    const c = { ...empty };
    for (const n of rows) c[n.status] += 1;
    return c;
  },
});

/** Composer loads by slug — the id never appears in the URL. */
export const getBySlug = query({
  args: { projectId: v.id("projects"), slug: v.string() },
  returns: v.union(v.null(), DETAIL),
  handler: async (ctx, args) => {
    const user = await getAuthedUserOrNull(ctx);
    if (!user) return null;
    const n = await ctx.db
      .query("newsletters")
      .withIndex("by_projectId_and_slug", (q) =>
        q.eq("projectId", args.projectId).eq("slug", args.slug),
      )
      .unique();
    if (!n || n.userId !== user._id) return null;
    return toDetail(n);
  },
});

export const create = mutation({
  args: {
    projectId: v.id("projects"),
    slug: v.string(),
    subject: v.optional(v.string()),
    bodyMarkdown: v.optional(v.string()),
    previewText: v.optional(v.string()),
  },
  returns: v.object({ slug: v.string() }),
  handler: async (ctx, args) => {
    const key = await getRateLimitKey(ctx);
    await rateLimiter.limit(ctx, "newsletter:edit", { key, throws: true });

    const user = await getCurrentUser(ctx);
    await assertOwnsProject(ctx, args.projectId, user._id);

    if (!SLUG_RE.test(args.slug)) {
      throw new ConvexError({ message: "Invalid slug." });
    }
    const clash = await ctx.db
      .query("newsletters")
      .withIndex("by_projectId_and_slug", (q) =>
        q.eq("projectId", args.projectId).eq("slug", args.slug),
      )
      .unique();
    if (clash) {
      // The client retries with a fresh random slug on collision.
      throw new ConvexError({ message: "slug-taken" });
    }

    const now = Date.now();
    await ctx.db.insert("newsletters", {
      projectId: args.projectId,
      userId: user._id,
      slug: args.slug,
      subject: args.subject?.trim() || "Untitled newsletter",
      bodyMarkdown: args.bodyMarkdown ?? "",
      ...(args.previewText ? { previewText: args.previewText } : {}),
      status: "draft" as const,
      createdAt: now,
      updatedAt: now,
    });
    return { slug: args.slug };
  },
});

/** Edit any field — only while it hasn't been sent/scheduled. */
export const update = mutation({
  args: {
    newsletterId: v.id("newsletters"),
    subject: v.optional(v.string()),
    bodyMarkdown: v.optional(v.string()),
    previewText: v.optional(v.string()),
    fromName: v.optional(v.string()),
    internalNote: v.optional(v.string()),
    listId: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const key = await getRateLimitKey(ctx);
    await rateLimiter.limit(ctx, "newsletter:edit", { key, throws: true });

    const user = await getCurrentUser(ctx);
    const n = await ctx.db.get(args.newsletterId);
    if (!n || n.userId !== user._id) {
      throw new ConvexError({ message: "Newsletter not found." });
    }
    if (n.status === "sent" || n.status === "scheduled") {
      throw new ConvexError({
        message: "A sent or scheduled newsletter can't be edited.",
      });
    }
    const patch: Record<string, unknown> = { updatedAt: Date.now() };
    if (args.subject !== undefined) {
      patch["subject"] = args.subject.trim() || "Untitled newsletter";
    }
    if (args.bodyMarkdown !== undefined) {
      patch["bodyMarkdown"] = args.bodyMarkdown;
    }
    if (args.previewText !== undefined) {
      patch["previewText"] = args.previewText.trim() || undefined;
    }
    if (args.fromName !== undefined) {
      patch["fromName"] = args.fromName.trim() || undefined;
    }
    if (args.internalNote !== undefined) {
      patch["internalNote"] = args.internalNote.trim() || undefined;
    }
    if (args.listId !== undefined) {
      patch["listId"] = args.listId || undefined;
    }
    await ctx.db.patch(args.newsletterId, patch);
    return null;
  },
});

/**
 * One-shot: give any pre-slug newsletter a stable slug derived from its id.
 * Run once via `bunx convex run newsletter/newsletters:_backfillSlugs`.
 */
export const _backfillSlugs = internalMutation({
  args: {},
  returns: v.object({ patched: v.number() }),
  handler: async (ctx) => {
    const rows = await ctx.db.query("newsletters").take(2000);
    let patched = 0;
    for (const n of rows) {
      if (!n.slug) {
        await ctx.db.patch(n._id, {
          slug: `nl-${String(n._id).slice(-12).toLowerCase()}`,
        });
        patched += 1;
      }
    }
    return { patched };
  },
});

export const remove = mutation({
  args: { newsletterId: v.id("newsletters") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const key = await getRateLimitKey(ctx);
    await rateLimiter.limit(ctx, "newsletter:edit", { key, throws: true });

    const user = await getCurrentUser(ctx);
    const n = await ctx.db.get(args.newsletterId);
    if (!n || n.userId !== user._id) return null;
    // A scheduled campaign lives in the provider — deleting here won't
    // unschedule it; the composer warns before allowing this.
    await ctx.db.delete(args.newsletterId);
    return null;
  },
});
