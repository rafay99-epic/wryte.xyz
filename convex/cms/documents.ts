import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import type { DatabaseReader } from "../_generated/server";
import {
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "../_generated/server";
import { getAuthedUserOrNull, getCurrentUser } from "../_lib/auth";
import { adjustDocumentCount } from "../_lib/documentCount";
import {
  scheduleStatusChange,
  scheduleWordActivity,
} from "../_lib/projectStats";
import { getRateLimitKey, rateLimiter } from "../_lib/rateLimits";
import { countWords } from "../_lib/wordCount";

/**
 * Verifies that a document exists and that the given user owns the parent project.
 * Follows the chain: document -> project -> project.userId === userId.
 * Returns the document if ownership is confirmed; throws otherwise.
 */
async function verifyDocumentOwnership(
  ctx: { db: DatabaseReader },
  documentId: Id<"documents">,
  userId: Id<"users">,
): Promise<Doc<"documents">> {
  const document = await ctx.db.get(documentId);
  if (!document) {
    throw new Error("Document not found");
  }

  const project = await ctx.db.get(document.projectId);
  if (!project) {
    throw new Error("Project not found");
  }

  if (project.userId !== userId) {
    throw new Error("Unauthorized: you do not own this document");
  }

  return document;
}

/**
 * Lists documents within a project, optionally filtered by status.
 * Uses the compound index `by_projectId_and_status` when a status filter is
 * provided for efficient querying, falling back to `by_projectId` otherwise.
 * Returns an empty array for unauthenticated or unauthorized users.
 *
 * @param args.projectId - The project whose documents to list.
 * @param args.status - Optional filter: "draft", "scheduled", or "published".
 * @returns Documents sorted by most recently updated.
 */
export const list = query({
  args: {
    projectId: v.id("projects"),
    status: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await getAuthedUserOrNull(ctx);
    if (!user) return [];

    const project = await ctx.db.get(args.projectId);
    if (!project || project.userId !== user._id) {
      return [];
    }

    let documents: Doc<"documents">[];
    if (args.status) {
      // No status+trashedAt compound index — keep the in-memory trash
      // filter but query a larger window so trash doesn't crowd out active
      // status-matched docs.
      const status = args.status;
      const raw = await ctx.db
        .query("documents")
        .withIndex("by_projectId_and_status", (q) =>
          q.eq("projectId", args.projectId).eq("status", status),
        )
        .take(2000);
      documents = raw.filter((d) => d.trashedAt === undefined);
    } else {
      // Use the trashedAt-aware index so trashed docs never enter the
      // candidate set and steal slots from active ones.
      documents = await ctx.db
        .query("documents")
        .withIndex("by_projectId_and_trashedAt", (q) =>
          q.eq("projectId", args.projectId).eq("trashedAt", undefined),
        )
        .take(500);
    }

    // Drop the big `content` blob from this hot reactive subscription — the
    // board, sidebar, and header all subscribe at once, so without this an
    // autosave on ANY doc re-pushes every full article body to every
    // subscriber. We keep every other field (incl. the small `frontmatter`)
    // and derive `excerpt` + `wordCount` server-side so the client still gets
    // exactly what it renders, minus the heaviest payload.
    return documents
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .map((d) => {
        const { content, ...rest } = d;
        return {
          ...rest,
          wordCount: content.split(/\s+/).filter(Boolean).length,
          excerpt:
            content.length > 200 ? `${content.slice(0, 200)}...` : content,
        };
      });
  },
});

/**
 * Paginated lean listing for the editor's `[[` internal-link menu —
 * id/title/slug only, newest first, trash excluded via the composite
 * index. The menu pulls a handful of rows at a time as the user scrolls,
 * so a project with hundreds of posts never ships its whole list at once.
 */
export const listForLink = query({
  args: {
    projectId: v.id("projects"),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const empty = { page: [], isDone: true, continueCursor: "" };
    const user = await getAuthedUserOrNull(ctx);
    if (!user) return empty;

    const project = await ctx.db.get(args.projectId);
    if (!project || project.userId !== user._id) return empty;

    const result = await ctx.db
      .query("documents")
      .withIndex("by_projectId_and_trashedAt", (q) =>
        q.eq("projectId", args.projectId).eq("trashedAt", undefined),
      )
      .order("desc")
      .paginate(args.paginationOpts);

    return {
      ...result,
      page: result.page.map((doc) => ({
        _id: doc._id,
        title: doc.title,
        slug: doc.slug,
      })),
    };
  },
});

/**
 * Title typeahead for the `[[` internal-link menu, backed by the
 * `search_title` index. Bounded result set; trash filtered post-take.
 */
export const searchForLink = query({
  args: {
    projectId: v.id("projects"),
    term: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await getAuthedUserOrNull(ctx);
    if (!user) return [];

    const project = await ctx.db.get(args.projectId);
    if (!project || project.userId !== user._id) return [];

    const term = args.term.trim();
    if (!term) return [];

    const docs = await ctx.db
      .query("documents")
      .withSearchIndex("search_title", (q) =>
        q.search("title", term).eq("projectId", args.projectId),
      )
      .take(10);

    return docs
      .filter((doc) => doc.trashedAt === undefined)
      .map((doc) => ({ _id: doc._id, title: doc.title, slug: doc.slug }));
  },
});

/**
 * Paginated full-content feed for the one-shot project export in
 * settings. Unlike `list` this DOES ship content + frontmatter — callers
 * walk pages imperatively (no reactive subscription), so the payload is
 * only ever paid when the user clicks Export.
 */
export const listForExport = query({
  args: {
    projectId: v.id("projects"),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const empty = { page: [], isDone: true, continueCursor: "" };
    const user = await getAuthedUserOrNull(ctx);
    if (!user) return empty;

    const project = await ctx.db.get(args.projectId);
    if (!project || project.userId !== user._id) return empty;

    const result = await ctx.db
      .query("documents")
      .withIndex("by_projectId_and_trashedAt", (q) =>
        q.eq("projectId", args.projectId).eq("trashedAt", undefined),
      )
      .paginate(args.paginationOpts);

    return {
      ...result,
      page: result.page.map((doc) => ({
        _id: doc._id,
        title: doc.title,
        slug: doc.slug,
        status: doc.status,
        content: doc.content,
        frontmatter: doc.frontmatter ?? null,
        updatedAt: doc.updatedAt,
      })),
    };
  },
});

/**
 * Documents for the on-demand link checker action — ownership verified
 * via tokenIdentifier since actions can't touch the DB directly.
 */
export const _listForLinkCheck = internalQuery({
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

    const docs = await ctx.db
      .query("documents")
      .withIndex("by_projectId_and_trashedAt", (q) =>
        q.eq("projectId", args.projectId).eq("trashedAt", undefined),
      )
      .take(500);
    return docs.map((doc) => ({
      _id: doc._id,
      title: doc.title,
      content: doc.content,
    }));
  },
});

/** Returns the N most recently updated documents, optionally scoped to a project. */
export const listRecent = query({
  args: {
    limit: v.optional(v.number()),
    projectId: v.optional(v.id("projects")),
  },
  handler: async (ctx, args) => {
    const user = await getAuthedUserOrNull(ctx);
    if (!user) return [];

    const limit = args.limit ?? 5;
    const pid = args.projectId;

    const documents = pid
      ? await ctx.db
          .query("documents")
          .withIndex("by_projectId_and_trashedAt", (q) =>
            q.eq("projectId", pid).eq("trashedAt", undefined),
          )
          .take(200)
      : await ctx.db
          .query("documents")
          .withIndex("by_userId", (q) => q.eq("userId", user._id))
          .take(200);

    // Metadata projection — consumers (command palette, dashboard recents) only
    // render title/status/time, so never ship the full `content` blob (this
    // reads up to 200 docs and would otherwise serialize all their bodies).
    return documents
      .filter((d) => d.trashedAt === undefined)
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, limit)
      .map((d) => ({
        _id: d._id,
        title: d.title,
        status: d.status,
        projectId: d.projectId,
        updatedAt: d.updatedAt,
      }));
  },
});

/**
 * Lists all documents across all projects for the current user.
 * Returns minimal fields for dashboard stats (avoids transferring full content).
 */
export const listAllForUser = query({
  args: {},
  handler: async (ctx) => {
    const user = await getAuthedUserOrNull(ctx);
    if (!user) return [];

    const documents = await ctx.db
      .query("documents")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .take(1000);

    return documents
      .filter((d) => d.trashedAt === undefined)
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .map((d) => ({
        _id: d._id,
        status: d.status,
        updatedAt: d.updatedAt,
        projectId: d.projectId,
      }));
  },
});

/**
 * Fetches a single document by ID with full ownership verification.
 *
 * @requires Authentication + document ownership (via parent project)
 * @param args.documentId - The document to retrieve.
 * @returns The document record.
 */
export const get = query({
  args: { documentId: v.id("documents") },
  handler: async (ctx, args) => {
    const user = await getAuthedUserOrNull(ctx);
    if (!user) {
      throw new Error("Not authenticated");
    }
    const document = await verifyDocumentOwnership(
      ctx,
      args.documentId,
      user._id,
    );
    // Trashed docs are invisible to the editor / dashboard. The trash
    // view fetches them through `trash.listByProject` instead.
    if (document.trashedAt !== undefined) {
      return null;
    }
    return document;
  },
});

/**
 * Creates a new blank document in draft status within the specified project.
 * Verifies the user owns the target project before inserting.
 *
 * @requires Authentication + project ownership
 * @param args.projectId - The project to add the document to.
 * @param args.title - Document title.
 * @param args.slug - URL-safe identifier used as the filename when publishing.
 * @returns The new document's ID.
 */
export const create = mutation({
  args: {
    projectId: v.id("projects"),
    title: v.string(),
    slug: v.string(),
    status: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
    frontmatter: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const key = await getRateLimitKey(ctx);
    await rateLimiter.limit(ctx, "documents:create", { key, throws: true });

    const user = await getCurrentUser(ctx);

    const project = await ctx.db.get(args.projectId);
    if (!project) {
      throw new Error("Project not found");
    }

    if (project.userId !== user._id) {
      throw new Error("Unauthorized: you do not own this project");
    }

    const now = Date.now();

    const status = args.status ?? "draft";
    const documentId = await ctx.db.insert("documents", {
      projectId: args.projectId,
      userId: user._id,
      title: args.title,
      slug: args.slug,
      content: "",
      wordCount: 0,
      status,
      createdAt: now,
      updatedAt: now,
      ...(args.tags !== undefined ? { tags: args.tags } : {}),
      ...(args.frontmatter !== undefined
        ? { frontmatter: args.frontmatter }
        : {}),
    });
    await adjustDocumentCount(ctx, args.projectId, 1);
    await scheduleStatusChange(ctx, {
      projectId: args.projectId,
      userId: user._id,
      oldStatus: null,
      newStatus: status,
    });

    return documentId;
  },
});

/**
 * Partially updates a document's content, metadata, or status.
 * Only fields that are explicitly provided are written; `updatedAt` is always refreshed.
 *
 * @requires Authentication + document ownership
 * @param args.documentId - The document to update.
 */
export const update = mutation({
  args: {
    documentId: v.id("documents"),
    title: v.optional(v.string()),
    slug: v.optional(v.string()),
    content: v.optional(v.string()),
    frontmatter: v.optional(v.string()),
    status: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
    boardPosition: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const key = await getRateLimitKey(ctx);
    await rateLimiter.limit(ctx, "documents:update", { key, throws: true });

    const user = await getCurrentUser(ctx);
    const document = await verifyDocumentOwnership(
      ctx,
      args.documentId,
      user._id,
    );

    // Status transitions that require side-effects (workflow scheduling /
    // cancellation, publish history, social cross-post) must go through
    // their dedicated APIs. Direct writes here would leave the workflow
    // queue out of sync with the document's apparent state — e.g. a doc
    // could appear scheduled with no firing workflow, or appear published
    // with no publish_history row.
    if (args.status !== undefined) {
      if (args.status === "scheduled") {
        throw new Error(
          "Use scheduling.schedule to move a document into the scheduled state.",
        );
      }
      if (args.status === "published") {
        throw new Error(
          "Use the publish action to publish a document; update cannot set status to 'published' directly.",
        );
      }
    }

    if (args.content !== undefined) {
      // Convex serializes documents as UTF-8 and enforces a 1MB per-document
      // ceiling. A `.length` check would be off by ~3× for CJK or emoji-
      // heavy content (UTF-16 code units vs UTF-8 bytes), so compute the
      // real byte size before comparing to the cap.
      const byteLength = new TextEncoder().encode(args.content).byteLength;
      if (byteLength > MAX_CONTENT_BYTES) {
        throw new Error(
          `Document content is too large (max ${String(Math.round(MAX_CONTENT_BYTES / 1024))} KB).`,
        );
      }
    }

    // Defense-in-depth lock: if the doc has an unresolved sync
    // conflict, edits are not allowed. The editor UI also blocks the
    // flow, but autosave fires from background timers and stale tabs,
    // so we re-check here to keep the divergence from compounding.
    const openConflict = await ctx.db
      .query("sync_conflicts")
      .withIndex("by_documentId", (q) => q.eq("documentId", args.documentId))
      .take(10);
    if (openConflict.some((c) => c.resolvedAt === undefined)) {
      throw new Error(
        "This document has a pending sync conflict. Resolve it before making changes.",
      );
    }

    const { documentId, ...updates } = args;
    const fieldsToUpdate: Record<string, unknown> = { updatedAt: Date.now() };

    for (const [key, value] of Object.entries(updates)) {
      if (value !== undefined) {
        fieldsToUpdate[key] = value;
      }
    }

    let wordCountDelta = 0;
    if (args.content !== undefined) {
      const newWordCount = countWords(args.content);
      fieldsToUpdate["wordCount"] = newWordCount;
      wordCountDelta = newWordCount - (document.wordCount ?? 0);
    }

    await ctx.db.patch(documentId, fieldsToUpdate);

    await scheduleWordActivity(ctx, {
      userId: user._id,
      projectId: document.projectId,
      wordCountDelta,
    });

    if (args.status !== undefined && args.status !== document.status) {
      await scheduleStatusChange(ctx, {
        projectId: document.projectId,
        userId: user._id,
        oldStatus: document.status,
        newStatus: args.status,
      });
    }
  },
});

/** Soft upper bound on document `content` length. Convex's 1MB doc limit
 *  is the hard ceiling — we keep things well below it so other fields
 *  retain budget and the UI doesn't have to deal with cryptic Convex
 *  errors from an oversize patch. */
const MAX_CONTENT_BYTES = 500 * 1024;

/**
 * Creates a duplicate of an existing document in the same project.
 * Copies content, frontmatter, tags, and status but generates a new slug.
 *
 * @requires Authentication + document ownership
 * @param args.documentId - The document to duplicate.
 * @returns The new document's ID.
 */
export const duplicate = mutation({
  args: {
    documentId: v.id("documents"),
  },
  handler: async (ctx, args) => {
    const key = await getRateLimitKey(ctx);
    await rateLimiter.limit(ctx, "documents:duplicate", { key, throws: true });

    const user = await getCurrentUser(ctx);
    const doc = await verifyDocumentOwnership(ctx, args.documentId, user._id);

    const now = Date.now();
    const newTitle = `${doc.title} (copy)`;
    const newSlug = `${doc.slug}-copy-${Date.now().toString(36)}`;

    const wc = countWords(doc.content);
    const newId = await ctx.db.insert("documents", {
      projectId: doc.projectId,
      userId: user._id,
      title: newTitle,
      slug: newSlug,
      content: doc.content,
      wordCount: wc,
      status: doc.status,
      createdAt: now,
      updatedAt: now,
      ...(doc.frontmatter ? { frontmatter: doc.frontmatter } : {}),
      ...(doc.tags ? { tags: doc.tags } : {}),
    });
    await scheduleWordActivity(ctx, {
      userId: user._id,
      projectId: doc.projectId,
      wordCountDelta: wc,
    });
    await scheduleStatusChange(ctx, {
      projectId: doc.projectId,
      userId: user._id,
      oldStatus: null,
      newStatus: doc.status,
    });
    return { documentId: newId, title: newTitle };
  },
});

/**
 * Transitions a document's status. When transitioning to "published",
 * `publishedAt` is automatically set to the current timestamp.
 *
 * @requires Authentication + document ownership
 * @param args.documentId - The document to update.
 * @param args.status - The new status: "draft", "scheduled", or "published".
 */
export const updateStatus = mutation({
  args: {
    documentId: v.id("documents"),
    status: v.string(),
  },
  handler: async (ctx, args) => {
    const key = await getRateLimitKey(ctx);
    await rateLimiter.limit(ctx, "documents:updateStatus", {
      key,
      throws: true,
    });

    const user = await getCurrentUser(ctx);
    const doc = await verifyDocumentOwnership(ctx, args.documentId, user._id);

    const now = Date.now();
    const updates: Record<string, unknown> = {
      status: args.status,
      updatedAt: now,
    };

    if (args.status === "published") {
      updates["publishedAt"] = now;
    }

    if (doc.status === "scheduled" && args.status !== "scheduled") {
      updates["scheduledAt"] = undefined;
    }

    await ctx.db.patch(args.documentId, updates);

    if (args.status !== doc.status) {
      await scheduleStatusChange(ctx, {
        projectId: doc.projectId,
        userId: user._id,
        oldStatus: doc.status,
        newStatus: args.status,
      });
    }
  },
});

/**
 * Soft-deletes a document by setting `trashedAt` and cancelling any
 * pending scheduled publishes. The doc disappears from every
 * user-facing query and surfaces in the project trash instead, where
 * the user can restore it or hard-delete. A daily cron drains items
 * older than the project's `trashRetentionDays` (default 30) — see
 * `convex/cms/trash.ts:_cleanupExpired`.
 *
 * Cancelling scheduled publishes prevents the workflow from firing
 * against a soft-deleted target. Users re-schedule manually on
 * restore.
 *
 * @requires Authentication + document ownership
 */
export const remove = mutation({
  args: { documentId: v.id("documents") },
  handler: async (ctx, args) => {
    const key = await getRateLimitKey(ctx);
    await rateLimiter.limit(ctx, "documents:remove", { key, throws: true });

    const user = await getCurrentUser(ctx);
    const document = await verifyDocumentOwnership(
      ctx,
      args.documentId,
      user._id,
    );

    await cascadeDeleteScheduledPublishesForDoc(ctx, args.documentId);
    await ctx.db.patch(args.documentId, { trashedAt: Date.now() });
    await adjustDocumentCount(ctx, document.projectId, -1);
    await scheduleWordActivity(ctx, {
      userId: user._id,
      projectId: document.projectId,
      wordCountDelta: -(document.wordCount ?? 0),
    });
    await scheduleStatusChange(ctx, {
      projectId: document.projectId,
      userId: user._id,
      oldStatus: document.status,
      newStatus: null,
    });
  },
});

/**
 * Imports a markdown file from GitHub into the project as a published document.
 * Uses `githubPath` for duplicate detection: if a document with the same GitHub
 * file path already exists in the project, it returns the existing document's ID
 * instead of creating a duplicate. This makes the import idempotent — safe to
 * retry or call multiple times for the same file.
 *
 * @requires Authentication + project ownership
 * @param args.githubPath - The file path in the repo, used as the dedup key.
 * @param args.githubSha - The Git blob SHA, used for future update detection.
 * @returns The document ID (existing or newly created).
 */
export const importFromGithub = mutation({
  args: {
    projectId: v.id("projects"),
    title: v.string(),
    slug: v.string(),
    content: v.string(),
    frontmatter: v.optional(v.string()),
    githubPath: v.string(),
    githubSha: v.string(),
  },
  handler: async (ctx, args) => {
    const key = await getRateLimitKey(ctx);
    await rateLimiter.limit(ctx, "documents:importFromGithub", {
      key,
      throws: true,
    });

    const user = await getCurrentUser(ctx);

    const project = await ctx.db.get(args.projectId);
    if (!project) {
      throw new Error("Project not found");
    }
    if (project.userId !== user._id) {
      throw new Error("Unauthorized: you do not own this project");
    }

    // Dedup by (projectId, githubPath) so re-importing the same file is a
    // no-op. Indexed lookup — O(log n), not O(n) over the whole project.
    const duplicate = await ctx.db
      .query("documents")
      .withIndex("by_projectId_and_githubPath", (q) =>
        q.eq("projectId", args.projectId).eq("githubPath", args.githubPath),
      )
      .unique();
    if (duplicate) {
      return duplicate._id;
    }

    const now = Date.now();

    const wc = countWords(args.content);
    const documentId = await ctx.db.insert("documents", {
      projectId: args.projectId,
      userId: user._id,
      title: args.title,
      slug: args.slug,
      content: args.content,
      wordCount: wc,
      status: "published",
      githubPath: args.githubPath,
      githubSha: args.githubSha,
      githubSyncedAt: now,
      publishedAt: now,
      createdAt: now,
      updatedAt: now,
      ...(args.frontmatter !== undefined && { frontmatter: args.frontmatter }),
    });
    await adjustDocumentCount(ctx, args.projectId, 1);
    await scheduleWordActivity(ctx, {
      userId: user._id,
      projectId: args.projectId,
      wordCountDelta: wc,
    });
    await scheduleStatusChange(ctx, {
      projectId: args.projectId,
      userId: user._id,
      oldStatus: null,
      newStatus: "published",
    });
    return documentId;
  },
});

/**
 * Auth-skipped internal twin of `importFromGithub` for the bulk-import
 * workpool job (`convex/github.ts:_importOneFromGithubJob`). The job has
 * no user session — the parent `startBulkImport` action already verified
 * project ownership before enqueuing, so this mutation just trusts its
 * caller and gets out of the way. Same dedup-by-githubPath behaviour.
 */
export const _importFromGithubInternal = internalMutation({
  args: {
    projectId: v.id("projects"),
    title: v.string(),
    slug: v.string(),
    content: v.string(),
    frontmatter: v.optional(v.string()),
    githubPath: v.string(),
    githubSha: v.string(),
  },
  handler: async (ctx, args): Promise<Id<"documents">> => {
    const project = await ctx.db.get(args.projectId);
    if (!project) {
      throw new Error("Project not found");
    }

    // Idempotent dedup — re-running the same file path is a no-op so
    // workpool retries don't duplicate documents. Indexed lookup so a
    // project with 10k+ docs doesn't melt under bulk-import retries.
    const duplicate = await ctx.db
      .query("documents")
      .withIndex("by_projectId_and_githubPath", (q) =>
        q.eq("projectId", args.projectId).eq("githubPath", args.githubPath),
      )
      .unique();
    if (duplicate) return duplicate._id;

    const now = Date.now();
    const wc = countWords(args.content);
    const id = await ctx.db.insert("documents", {
      projectId: args.projectId,
      userId: project.userId,
      title: args.title,
      slug: args.slug,
      content: args.content,
      wordCount: wc,
      status: "published",
      githubPath: args.githubPath,
      githubSha: args.githubSha,
      githubSyncedAt: now,
      publishedAt: now,
      createdAt: now,
      updatedAt: now,
      ...(args.frontmatter !== undefined && { frontmatter: args.frontmatter }),
    });
    await adjustDocumentCount(ctx, args.projectId, 1);
    await scheduleWordActivity(ctx, {
      userId: project.userId,
      projectId: args.projectId,
      wordCountDelta: wc,
    });
    await scheduleStatusChange(ctx, {
      projectId: args.projectId,
      userId: project.userId,
      oldStatus: null,
      newStatus: "published",
    });
    return id;
  },
});

/**
 * Looks up a document by its slug within a project. Returns null for
 * unauthenticated/unauthorized users rather than throwing, so the client
 * can handle missing documents gracefully.
 *
 * @param args.projectId - The project to search within.
 * @param args.slug - The document slug to find.
 * @returns The matching document, or null.
 */
export const getBySlug = query({
  args: {
    projectId: v.id("projects"),
    slug: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await getAuthedUserOrNull(ctx);
    if (!user) return null;

    const project = await ctx.db.get(args.projectId);
    if (!project || project.userId !== user._id) {
      return null;
    }

    // Use the trashedAt-aware index so trash never crowds out the active
    // doc with the requested slug.
    const documents = await ctx.db
      .query("documents")
      .withIndex("by_projectId_and_trashedAt", (q) =>
        q.eq("projectId", args.projectId).eq("trashedAt", undefined),
      )
      .take(2000);

    return documents.find((d) => d.slug === args.slug) ?? null;
  },
});

/**
 * Toggles the bookmarked flag on a document.
 * If the document is currently bookmarked it becomes un-bookmarked, and vice versa.
 *
 * @requires Authentication + document ownership
 * @param args.documentId - The document to toggle.
 * @returns The new bookmarked state.
 */
export const toggleBookmark = mutation({
  args: { documentId: v.id("documents") },
  handler: async (ctx, args) => {
    const key = await getRateLimitKey(ctx);
    await rateLimiter.limit(ctx, "documents:toggleBookmark", {
      key,
      throws: true,
    });

    const user = await getCurrentUser(ctx);
    const document = await verifyDocumentOwnership(
      ctx,
      args.documentId,
      user._id,
    );

    const newBookmarked = !document.bookmarked;
    await ctx.db.patch(args.documentId, {
      bookmarked: newBookmarked,
      updatedAt: Date.now(),
    });

    return newBookmarked;
  },
});

/**
 * Internal-only query to fetch a document by ID without auth checks.
 * Used by server-side actions that have already verified access.
 */
export const internalGet = internalQuery({
  args: { documentId: v.id("documents") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.documentId);
  },
});

/**
 * Pre-flight check for bulk delete: returns only those documents whose
 * ID is in `ids` AND whose `projectId` matches. `startBulkDelete`
 * compares `result.length` to `ids.length` to detect cross-project ids
 * before enqueuing N workpool jobs that would silently no-op.
 */
export const _listByIdsForProject = internalQuery({
  args: {
    ids: v.array(v.id("documents")),
    projectId: v.id("projects"),
  },
  handler: async (ctx, args) => {
    const docs = await Promise.all(args.ids.map((id) => ctx.db.get(id)));
    return docs.filter(
      (d): d is NonNullable<typeof d> =>
        d !== null &&
        d.projectId === args.projectId &&
        d.trashedAt === undefined,
    );
  },
});

/**
 * Internal mutation to update document content.
 * Used by the publish action to rewrite Convex media URLs to GitHub paths.
 */
export const internalUpdate = internalMutation({
  args: {
    documentId: v.id("documents"),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.documentId, {
      content: args.content,
      updatedAt: Date.now(),
    });
  },
});

/**
 * Internal mutation called after a successful GitHub publish to record
 * the resulting file path, SHA, and publication timestamp on the document.
 * Keeping this separate from the GitHub action allows the action to remain
 * stateless while the mutation handles the database write transactionally.
 */
/**
 * Moves a board card to a new column and position.
 * Used by the kanban board's drag-and-drop handler to update a document's
 * status and ordering in a single atomic operation.
 *
 * Returns the target column's behavior so the client knows whether to
 * trigger publish or schedule flows.
 */
export const moveCard = mutation({
  args: {
    documentId: v.id("documents"),
    targetStatus: v.string(),
    boardPosition: v.number(),
  },
  handler: async (ctx, args) => {
    const key = await getRateLimitKey(ctx);
    await rateLimiter.limit(ctx, "documents:moveCard", { key, throws: true });

    // Convex's v.number() accepts NaN and ±Infinity. Clamp to a safe range
    // so downstream sort / render code doesn't break.
    if (!Number.isFinite(args.boardPosition)) {
      throw new Error("boardPosition must be a finite number");
    }
    const clampedPosition = Math.max(
      0,
      Math.min(args.boardPosition, Number.MAX_SAFE_INTEGER),
    );

    const user = await getCurrentUser(ctx);
    const document = await verifyDocumentOwnership(
      ctx,
      args.documentId,
      user._id,
    );

    const updates: Record<string, unknown> = {
      status: args.targetStatus,
      boardPosition: clampedPosition,
      updatedAt: Date.now(),
    };

    // Check if the target column has special behavior
    const project = await ctx.db.get(document.projectId as Id<"projects">);
    let behavior = "none";

    if (project && "boardColumns" in project && project.boardColumns) {
      try {
        const columns = JSON.parse(project.boardColumns) as Array<{
          id: string;
          behavior: string;
        }>;
        const targetCol = columns.find((c) => c.id === args.targetStatus);
        if (targetCol) {
          behavior = targetCol.behavior;
          if (targetCol.behavior === "publish") {
            updates["publishedAt"] = Date.now();
          }
        }
      } catch {
        // Invalid board columns JSON, fall through
      }
    } else {
      // No custom columns — use default behavior mapping
      if (args.targetStatus === "published") {
        updates["publishedAt"] = Date.now();
        behavior = "publish";
      } else if (args.targetStatus === "scheduled") {
        behavior = "schedule";
      }
    }

    await ctx.db.patch(args.documentId, updates);

    if (args.targetStatus !== document.status) {
      await scheduleStatusChange(ctx, {
        projectId: document.projectId,
        userId: user._id,
        oldStatus: document.status,
        newStatus: args.targetStatus,
      });
    }

    return { behavior };
  },
});

/**
 * Updates the tags on a document, keeping both the denormalized `tags` array
 * and the `frontmatter` JSON string in sync.
 */
export const updateTags = mutation({
  args: {
    documentId: v.id("documents"),
    tags: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const key = await getRateLimitKey(ctx);
    await rateLimiter.limit(ctx, "documents:updateTags", { key, throws: true });

    const user = await getCurrentUser(ctx);
    await verifyDocumentOwnership(ctx, args.documentId, user._id);

    const doc = await ctx.db.get(args.documentId);

    // Update tags in frontmatter JSON to keep in sync
    let frontmatter: Record<string, unknown> = {};
    if (doc?.frontmatter) {
      try {
        frontmatter = JSON.parse(doc.frontmatter);
      } catch {
        // Invalid JSON, start fresh
      }
    }
    frontmatter["tags"] = args.tags;

    await ctx.db.patch(args.documentId, {
      tags: args.tags,
      frontmatter: JSON.stringify(frontmatter),
      updatedAt: Date.now(),
    });
  },
});

export const internalUpdateAfterPublish = internalMutation({
  args: {
    documentId: v.id("documents"),
    githubPath: v.string(),
    githubSha: v.optional(v.string()),
    status: v.string(),
    publishedAt: v.number(),
  },
  handler: async (ctx, args) => {
    const doc = await ctx.db.get(args.documentId);
    const patch: Record<string, unknown> = {
      githubPath: args.githubPath,
      githubSyncedAt: Date.now(),
      status: args.status,
      publishedAt: args.publishedAt,
      updatedAt: Date.now(),
    };
    if (args.githubSha !== undefined) {
      patch["githubSha"] = args.githubSha;
    }
    await ctx.db.patch(args.documentId, patch);

    if (doc && args.status !== doc.status) {
      await scheduleStatusChange(ctx, {
        projectId: doc.projectId,
        userId: doc.userId,
        oldStatus: doc.status,
        newStatus: args.status,
      });
    }
    if (doc && args.status === "published") {
      await ctx.scheduler.runAfter(
        0,
        internal.analytics.writingStats._incrementPublished,
        { userId: doc.userId },
      );
    }
  },
});

/* ------------------------------------------------------------------ */
/*  Publish history                                                    */
/* ------------------------------------------------------------------ */

/**
 * Records a publish event in the history table.
 * Called internally after every successful GitHub publish.
 */
export const internalRecordPublishHistory = internalMutation({
  args: {
    documentId: v.id("documents"),
    projectId: v.id("projects"),
    userId: v.id("users"),
    commitSha: v.string(),
    commitUrl: v.optional(v.string()),
    githubPath: v.string(),
    commitMessage: v.string(),
    contentSnapshot: v.string(),
    frontmatterSnapshot: v.optional(v.string()),
    titleSnapshot: v.string(),
    isUpdate: v.boolean(),
    isBulk: v.optional(v.boolean()),
    bulkBatchId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("publish_history", {
      ...args,
      createdAt: Date.now(),
    });
  },
});

/**
 * Returns the publish history for a document, newest first.
 */
export const getPublishHistory = query({
  args: {
    documentId: v.id("documents"),
  },
  handler: async (ctx, args) => {
    const user = await getAuthedUserOrNull(ctx);
    if (!user) return [];

    const document = await ctx.db.get(args.documentId);
    if (!document) return [];
    const project = await ctx.db.get(document.projectId);
    if (!project || project.userId !== user._id) return [];

    const history = await ctx.db
      .query("publish_history")
      .withIndex("by_documentId", (q) => q.eq("documentId", args.documentId))
      .order("desc")
      .take(100);

    return history;
  },
});

/**
 * Rolls back a document to a previous published version.
 * Restores title, content, and frontmatter from the history snapshot.
 */
export const rollbackToVersion = mutation({
  args: {
    documentId: v.id("documents"),
    historyId: v.id("publish_history"),
  },
  handler: async (ctx, args) => {
    const key = await getRateLimitKey(ctx);
    await rateLimiter.limit(ctx, "documents:rollbackToVersion", {
      key,
      throws: true,
    });

    const user = await getCurrentUser(ctx);

    const document = await ctx.db.get(args.documentId);
    if (!document) throw new Error("Document not found");
    const project = await ctx.db.get(document.projectId);
    if (!project || project.userId !== user._id) {
      throw new Error("Unauthorized");
    }

    const historyEntry = await ctx.db.get(args.historyId);
    if (!historyEntry || historyEntry.documentId !== args.documentId) {
      throw new Error(
        "History entry not found or does not belong to this document",
      );
    }

    await ctx.db.patch(args.documentId, {
      title: historyEntry.titleSnapshot,
      content: historyEntry.contentSnapshot,
      frontmatter: historyEntry.frontmatterSnapshot,
      updatedAt: Date.now(),
    });

    return {
      title: historyEntry.titleSnapshot,
      restoredFrom: historyEntry.createdAt,
    };
  },
});

/**
 * Lightweight query for the content calendar view.
 *
 * Returns all documents for a project with only the fields needed for
 * calendar rendering (no content/frontmatter), keeping the payload small.
 */
export const listForCalendar = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    const user = await getAuthedUserOrNull(ctx);
    if (!user) return [];

    const project = await ctx.db.get(args.projectId);
    if (!project || project.userId !== user._id) return [];

    const documents = await ctx.db
      .query("documents")
      .withIndex("by_projectId_and_trashedAt", (q) =>
        q.eq("projectId", args.projectId).eq("trashedAt", undefined),
      )
      .take(500);

    return documents.map((d) => ({
      _id: d._id,
      title: d.title,
      slug: d.slug,
      status: d.status,
      scheduledAt: d.scheduledAt,
      publishedAt: d.publishedAt,
      updatedAt: d.updatedAt,
      createdAt: d.createdAt,
    }));
  },
});

/* ------------------------------------------------------------------ */
/*  Bulk import — tracking, progress, and workpool callback             */
/* ------------------------------------------------------------------ */

/**
 * Creates the `import_batches` row that `convex/github.ts:startBulkImport`
 * uses to track progress. Internal-only because the caller has already
 * resolved auth + ownership in the parent action.
 */
export const _createImportBatch = internalMutation({
  args: {
    projectId: v.id("projects"),
    userId: v.id("users"),
    total: v.number(),
  },
  handler: async (ctx, args): Promise<Id<"import_batches">> => {
    const now = Date.now();
    // Counts (`succeeded`, `failed`, `errors`) are now derived from
    // `import_job_outcomes` to avoid OCC contention — leaving them off
    // the new row entirely. The schema keeps them optional for legacy
    // rows.
    return await ctx.db.insert("import_batches", {
      projectId: args.projectId,
      userId: args.userId,
      total: args.total,
      createdAt: now,
      updatedAt: now,
    });
  },
});

/**
 * Workpool `onComplete` callback for the GitHub bulk-import pool. Runs
 * once per finished job — succeeded, failed, or canceled.
 *
 * Each callback inserts a brand-new `import_job_outcomes` row instead
 * of patching the parent batch. That eliminates the OCC hotspot that
 * comes from N parallel callbacks fighting over a single row's counters
 * — see https://docs.convex.dev/error#1. The `getImportBatch` query
 * aggregates outcomes to compute live succeeded/failed/errors.
 */
export const _onImportFileComplete = internalMutation({
  args: {
    workId: v.string(),
    context: v.any(),
    result: v.any(),
  },
  handler: async (ctx, args) => {
    const { batchId, filePath } = args.context as {
      batchId: Id<"import_batches">;
      filePath: string;
    };
    const result = args.result as
      | { kind: "success"; returnValue: unknown }
      | { kind: "failed"; error: string }
      | { kind: "canceled" };

    // Defense in depth: if the batch row is gone (manually cleaned up
    // before workpool drained), don't leave orphaned outcomes.
    const batch = await ctx.db.get(batchId);
    if (!batch) return;

    if (result.kind === "success") {
      await ctx.db.insert("import_job_outcomes", {
        batchId,
        status: "success",
        filePath,
        createdAt: Date.now(),
      });
      return;
    }

    const errorMessage =
      result.kind === "failed" ? result.error : "Import cancelled";
    await ctx.db.insert("import_job_outcomes", {
      batchId,
      status: "failure",
      filePath,
      errorMessage,
      createdAt: Date.now(),
    });
  },
});

/**
 * Reactive read for the import progress UI. Returns the batch row
 * enriched with aggregated `succeeded` / `failed` / `errors` derived
 * from `import_job_outcomes` (which is contention-free — every job
 * inserts its own row). Returns null if the caller doesn't own the
 * batch's project.
 *
 * Note on cost: this aggregates by `collect()`-ing every outcome row
 * for the batch on each read. For our max batch size (200 files) that's
 * fine. If batch sizes grow, replace with the `@convex-dev/aggregate`
 * component which maintains running counters lock-free.
 */
export const getImportBatch = query({
  args: { batchId: v.id("import_batches") },
  handler: async (ctx, args) => {
    const user = await getAuthedUserOrNull(ctx);
    if (!user) return null;

    const batch = await ctx.db.get(args.batchId);
    if (!batch || batch.userId !== user._id) return null;

    const outcomes = await ctx.db
      .query("import_job_outcomes")
      .withIndex("by_batchId", (q) => q.eq("batchId", args.batchId))
      .take(500);

    let succeeded = 0;
    let failed = 0;
    const MAX_ERRORS_RETURNED = 20;
    const errors: Array<{ filePath: string; message: string }> = [];
    for (const o of outcomes) {
      if (o.status === "success") {
        succeeded += 1;
      } else {
        failed += 1;
        if (errors.length < MAX_ERRORS_RETURNED) {
          errors.push({
            filePath: o.filePath,
            message: o.errorMessage ?? "Unknown error",
          });
        }
      }
    }

    return {
      ...batch,
      succeeded,
      failed,
      errors,
    };
  },
});

/* ------------------------------------------------------------------ */
/*  Bulk delete — tracking, progress, and workpool callback             */
/* ------------------------------------------------------------------ */

/**
 * Auth-skipped internal version of `remove` for the bulk-delete workpool
 * job. The job has no user session — the parent `startBulkDelete` action
 * verified the user owns `projectId` before enqueuing.
 *
 * **Project-bound for defense in depth.** Even though the parent action
 * validates ownership of `projectId`, an internal action could in
 * principle be called with a `documentId` that belongs to *another*
 * project (e.g. a future bug, a malicious refactor, or a forged caller).
 * We re-verify here that `doc.projectId === args.projectId` and
 * no-op silently if not. Combined with `startBulkDelete`'s pre-flight
 * filter, this means cross-project deletion is impossible by
 * construction.
 *
 * Preserves the cascade to `scheduled_publishes` via
 * `cascadeDeleteScheduledPublishesForDoc` so no orphaned workflow jobs
 * fire against a deleted doc.
 */
export const _removeInternal = internalMutation({
  args: {
    documentId: v.id("documents"),
    projectId: v.id("projects"),
  },
  handler: async (ctx, args) => {
    const doc = await ctx.db.get(args.documentId);
    if (!doc) return;
    if (doc.projectId !== args.projectId) {
      // Refuse to act on docs outside the scope the caller verified.
      // Silent return rather than throw — callers loop over many docs
      // and one bad id shouldn't halt the whole batch.
      return;
    }
    if (doc.trashedAt !== undefined) {
      // Already trashed — idempotent no-op so retries don't error.
      return;
    }

    await cascadeDeleteScheduledPublishesForDoc(ctx, args.documentId);
    await ctx.db.patch(args.documentId, { trashedAt: Date.now() });
    await adjustDocumentCount(ctx, args.projectId, -1);
    const project = await ctx.db.get(args.projectId);
    if (project) {
      await scheduleWordActivity(ctx, {
        userId: project.userId,
        projectId: args.projectId,
        wordCountDelta: -(doc.wordCount ?? 0),
      });
      await scheduleStatusChange(ctx, {
        projectId: args.projectId,
        userId: project.userId,
        oldStatus: doc.status,
        newStatus: null,
      });
    }
  },
});

/**
 * Bulk soft-delete for "local only" mode in `startBulkDelete`. Skips
 * the workpool entirely — a 50-doc local delete now takes one
 * function call instead of ~250. Caps the batch at 50 ids per call
 * so the mutation stays comfortably under Convex's per-transaction
 * limits; the action layer iterates if more were requested.
 *
 * The caller has already verified that `args.documentIds` all belong
 * to `args.projectId`; we still check each doc defensively so a stale
 * id can't slip past.
 */
export const _bulkSoftDeleteLocal = internalMutation({
  args: {
    projectId: v.id("projects"),
    documentIds: v.array(v.id("documents")),
  },
  handler: async (ctx, args): Promise<{ trashed: number }> => {
    const now = Date.now();
    let trashed = 0;
    let totalWordsDelta = 0;
    const statusDeltas: Record<string, number> = {};
    let userId: Id<"users"> | null = null;
    for (const id of args.documentIds) {
      const doc = await ctx.db.get(id);
      if (!doc) continue;
      if (doc.projectId !== args.projectId) continue;
      if (doc.trashedAt !== undefined) continue;
      await cascadeDeleteScheduledPublishesForDoc(ctx, id);
      await ctx.db.patch(id, { trashedAt: now });
      await adjustDocumentCount(ctx, args.projectId, -1);
      totalWordsDelta -= doc.wordCount ?? 0;
      statusDeltas[doc.status] = (statusDeltas[doc.status] ?? 0) - 1;
      userId = doc.userId;
      trashed += 1;
    }
    if (userId && totalWordsDelta !== 0) {
      await scheduleWordActivity(ctx, {
        userId,
        projectId: args.projectId,
        wordCountDelta: totalWordsDelta,
      });
    }
    if (userId) {
      for (const [status, delta] of Object.entries(statusDeltas)) {
        if (delta === 0) continue;
        await scheduleStatusChange(ctx, {
          projectId: args.projectId,
          userId,
          oldStatus: delta < 0 ? status : null,
          newStatus: delta > 0 ? status : null,
          count: Math.abs(delta),
        });
      }
    }
    return { trashed };
  },
});

/**
 * Removes every `scheduled_publishes` row pointing at a document so
 * workflow jobs don't fire against a deleted target. Used by the
 * single-doc `remove` mutation, the bulk-delete workpool job, and the
 * project-cascade `projects.remove` — same cascade, one place to
 * maintain it. Exported so cross-file callers don't duplicate the loop.
 */
export async function cascadeDeleteScheduledPublishesForDoc(
  ctx: { db: MutationCtxDb },
  documentId: Id<"documents">,
): Promise<void> {
  const scheduledPublishes = await ctx.db
    .query("scheduled_publishes")
    .withIndex("by_documentId", (q) => q.eq("documentId", documentId))
    .take(50);
  for (const sp of scheduledPublishes) {
    await ctx.db.delete(sp._id);
  }
}

/** Minimal writer shape for the cascade helper — keeps it usable from
 *  both `mutation` and `internalMutation` ctx without dragging in the
 *  full Convex generic. */
type MutationCtxDb = import("../_generated/server").MutationCtx["db"];

/**
 * Creates the tracking row for a bulk delete. Mirror of
 * `_createImportBatch`. Caller has already validated ownership.
 */
export const _createDeleteBatch = internalMutation({
  args: {
    projectId: v.id("projects"),
    userId: v.id("users"),
    mode: v.union(v.literal("local"), v.literal("github"), v.literal("both")),
    total: v.number(),
  },
  handler: async (ctx, args): Promise<Id<"delete_batches">> => {
    const now = Date.now();
    return await ctx.db.insert("delete_batches", {
      projectId: args.projectId,
      userId: args.userId,
      mode: args.mode,
      total: args.total,
      createdAt: now,
      updatedAt: now,
    });
  },
});

/**
 * Workpool `onComplete` callback for bulk delete. Mirror of
 * `_onImportFileComplete` — inserts per-item outcome rows instead of
 * patching shared counters.
 */
export const _onDeleteFileComplete = internalMutation({
  args: {
    workId: v.string(),
    context: v.any(),
    result: v.any(),
  },
  handler: async (ctx, args) => {
    const { batchId, label } = args.context as {
      batchId: Id<"delete_batches">;
      label: string;
    };
    const result = args.result as
      | { kind: "success"; returnValue: unknown }
      | { kind: "failed"; error: string }
      | { kind: "canceled" };

    const batch = await ctx.db.get(batchId);
    if (!batch) return;

    if (result.kind === "success") {
      await ctx.db.insert("delete_job_outcomes", {
        batchId,
        status: "success",
        label,
        createdAt: Date.now(),
      });
      return;
    }

    const errorMessage =
      result.kind === "failed" ? result.error : "Delete cancelled";
    await ctx.db.insert("delete_job_outcomes", {
      batchId,
      status: "failure",
      label,
      errorMessage,
      createdAt: Date.now(),
    });
  },
});

/**
 * Reactive read for the bulk-delete progress UI. Mirrors `getImportBatch`
 * — counts derive from `delete_job_outcomes` rather than the batch row.
 */
export const getDeleteBatch = query({
  args: { batchId: v.id("delete_batches") },
  handler: async (ctx, args) => {
    const user = await getAuthedUserOrNull(ctx);
    if (!user) return null;

    const batch = await ctx.db.get(args.batchId);
    if (!batch || batch.userId !== user._id) return null;

    const outcomes = await ctx.db
      .query("delete_job_outcomes")
      .withIndex("by_batchId", (q) => q.eq("batchId", args.batchId))
      .take(500);

    let succeeded = 0;
    let failed = 0;
    const MAX_ERRORS_RETURNED = 20;
    const errors: Array<{ label: string; message: string }> = [];
    for (const o of outcomes) {
      if (o.status === "success") {
        succeeded += 1;
      } else {
        failed += 1;
        if (errors.length < MAX_ERRORS_RETURNED) {
          errors.push({
            label: o.label,
            message: o.errorMessage ?? "Unknown error",
          });
        }
      }
    }

    return {
      ...batch,
      succeeded,
      failed,
      errors,
    };
  },
});

/* ------------------------------------------------------------------ */
/*  Smart sync — diff-before-enqueue support                            */
/* ------------------------------------------------------------------ */

/**
 * Returns the existing Convex docs (lite shape) for a set of GitHub
 * paths within a project, used by `startBulkImport` to classify each
 * requested path as new / unchanged / fast-forward / conflict.
 *
 * Trashed docs are excluded — re-importing a path that points to a
 * doc currently in the trash treats it as `new` (the import will
 * create a fresh row, the trashed row stays put until its retention
 * expires). That's deliberate: a user who deleted then re-imported
 * almost certainly wants a clean slate.
 *
 * Per-path indexed lookup so projects with many docs don't pay the
 * cost of a full project scan. Convex's `unique()` on the
 * `by_projectId_and_githubPath` index returns null when no match,
 * which we elide from the result.
 */
export const _getExistingGithubFilesByPaths = internalQuery({
  args: {
    projectId: v.id("projects"),
    paths: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const results: Array<{
      documentId: Id<"documents">;
      githubPath: string;
      githubSha: string | undefined;
      updatedAt: number;
      githubSyncedAt: number | undefined;
      content: string;
      frontmatter: string | undefined;
    }> = [];
    for (const path of args.paths) {
      const doc = await ctx.db
        .query("documents")
        .withIndex("by_projectId_and_githubPath", (q) =>
          q.eq("projectId", args.projectId).eq("githubPath", path),
        )
        .unique();
      if (!doc || doc.trashedAt !== undefined) continue;
      results.push({
        documentId: doc._id,
        githubPath: path,
        githubSha: doc.githubSha,
        updatedAt: doc.updatedAt,
        githubSyncedAt: doc.githubSyncedAt,
        content: doc.content,
        frontmatter: doc.frontmatter,
      });
    }
    return results;
  },
});

/**
 * Internal upsert used by `_importOneFromGithubJob` after the action's
 * diff-before-enqueue logic has classified the path as `new` or
 * `fast-forward`. Unlike the older `_importFromGithubInternal` it does
 * not dedup-and-return — by this point the caller already knows it
 * wants the doc written. Stamps `githubSyncedAt` so the next sync
 * starts from a clean baseline.
 */
export const _upsertImportedDocument = internalMutation({
  args: {
    projectId: v.id("projects"),
    title: v.string(),
    slug: v.string(),
    content: v.string(),
    frontmatter: v.optional(v.string()),
    githubPath: v.string(),
    githubSha: v.string(),
    githubSyncedAt: v.number(),
    /**
     * The classifier in `startBulkImport` resolves this. `new` inserts,
     * `fastForward` patches the existing row. Passed explicitly so
     * this mutation has no side-channel — it can't accidentally create
     * duplicate rows for a known path.
     */
    mode: v.union(v.literal("new"), v.literal("fastForward")),
  },
  handler: async (ctx, args): Promise<Id<"documents">> => {
    const project = await ctx.db.get(args.projectId);
    if (!project) throw new Error("Project not found");

    const existing = await ctx.db
      .query("documents")
      .withIndex("by_projectId_and_githubPath", (q) =>
        q.eq("projectId", args.projectId).eq("githubPath", args.githubPath),
      )
      .unique();

    const now = Date.now();

    const newWc = countWords(args.content);

    if (args.mode === "fastForward" && existing) {
      const oldWc = existing.wordCount ?? 0;
      const patch: Record<string, unknown> = {
        title: args.title,
        slug: args.slug,
        content: args.content,
        wordCount: newWc,
        githubSha: args.githubSha,
        githubSyncedAt: args.githubSyncedAt,
        updatedAt: now,
      };
      if (args.frontmatter !== undefined) {
        patch["frontmatter"] = args.frontmatter;
      }
      await ctx.db.patch(existing._id, patch);
      await scheduleWordActivity(ctx, {
        userId: project.userId,
        projectId: args.projectId,
        wordCountDelta: newWc - oldWc,
      });
      return existing._id;
    }

    if (existing) {
      const oldWc = existing.wordCount ?? 0;
      const patch: Record<string, unknown> = {
        content: args.content,
        wordCount: newWc,
        githubSha: args.githubSha,
        githubSyncedAt: args.githubSyncedAt,
        updatedAt: now,
      };
      if (args.frontmatter !== undefined) {
        patch["frontmatter"] = args.frontmatter;
      }
      await ctx.db.patch(existing._id, patch);
      await scheduleWordActivity(ctx, {
        userId: project.userId,
        projectId: args.projectId,
        wordCountDelta: newWc - oldWc,
      });
      return existing._id;
    }

    const id = await ctx.db.insert("documents", {
      projectId: args.projectId,
      userId: project.userId,
      title: args.title,
      slug: args.slug,
      content: args.content,
      wordCount: newWc,
      status: "published",
      githubPath: args.githubPath,
      githubSha: args.githubSha,
      githubSyncedAt: args.githubSyncedAt,
      publishedAt: now,
      createdAt: now,
      updatedAt: now,
      ...(args.frontmatter !== undefined && { frontmatter: args.frontmatter }),
    });
    await adjustDocumentCount(ctx, args.projectId, 1);
    await scheduleWordActivity(ctx, {
      userId: project.userId,
      projectId: args.projectId,
      wordCountDelta: newWc,
    });
    await scheduleStatusChange(ctx, {
      projectId: args.projectId,
      userId: project.userId,
      oldStatus: null,
      newStatus: "published",
    });
    return id;
  },
});

/**
 * One-shot backfill: any doc that has a `githubSha` set but no
 * `githubSyncedAt` is assumed to be in sync with GitHub as of right now,
 * so the next sync doesn't flag it as a conflict.
 *
 * Implemented as a self-scheduling chunk pattern (per Convex guidelines):
 * each mutation processes one page and reschedules itself for the next.
 * The previous while-loop variant ran every page in a single transaction
 * which risked hitting per-transaction read/write limits on larger
 * deployments and leaving the backfill half-applied.
 *
 * Kick off via the Convex dashboard with `cursor: undefined`. The action
 * returns the per-page counts; the rolled-up `_backfillGithubSyncedAt`
 * entry point reports the totals when the run completes.
 */
const BACKFILL_BATCH_SIZE = 100;

export const _backfillGithubSyncedAt = internalMutation({
  args: {
    cursor: v.optional(v.union(v.string(), v.null())),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    let patched = 0;
    const result = await ctx.db.query("documents").paginate({
      numItems: BACKFILL_BATCH_SIZE,
      cursor: args.cursor ?? null,
    });
    for (const doc of result.page) {
      if (doc.githubSha && doc.githubSyncedAt === undefined) {
        await ctx.db.patch(doc._id, { githubSyncedAt: now });
        patched += 1;
      }
    }
    if (!result.isDone) {
      await ctx.scheduler.runAfter(
        0,
        internal.cms.documents._backfillGithubSyncedAt,
        { cursor: result.continueCursor },
      );
    }
    return {
      patched,
      scanned: result.page.length,
      isDone: result.isDone,
      cursor: result.continueCursor,
    };
  },
});
