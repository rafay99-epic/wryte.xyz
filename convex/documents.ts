import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import type { DatabaseReader } from "./_generated/server";
import {
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./_generated/server";
import { getCurrentUser } from "./auth_helpers";

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
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return [];
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_tokenIdentifier", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier),
      )
      .unique();

    if (!user) {
      return [];
    }

    const project = await ctx.db.get(args.projectId);
    if (!project || project.userId !== user._id) {
      return [];
    }

    let documents: Doc<"documents">[];
    if (args.status) {
      const status = args.status;
      documents = await ctx.db
        .query("documents")
        .withIndex("by_projectId_and_status", (q) =>
          q.eq("projectId", args.projectId).eq("status", status),
        )
        .collect();
    } else {
      documents = await ctx.db
        .query("documents")
        .withIndex("by_projectId", (q) => q.eq("projectId", args.projectId))
        .collect();
    }

    return documents.sort((a, b) => b.updatedAt - a.updatedAt);
  },
});

/** Returns the N most recently updated documents across all projects for the current user. */
export const listRecent = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return [];
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_tokenIdentifier", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier),
      )
      .unique();

    if (!user) {
      return [];
    }

    const limit = args.limit ?? 5;

    const documents = await ctx.db
      .query("documents")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .collect();

    return documents.sort((a, b) => b.updatedAt - a.updatedAt).slice(0, limit);
  },
});

/**
 * Lists all documents across all projects for the current user.
 * Returns minimal fields for dashboard stats (avoids transferring full content).
 */
export const listAllForUser = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return [];
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_tokenIdentifier", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier),
      )
      .unique();

    if (!user) {
      return [];
    }

    const documents = await ctx.db
      .query("documents")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .collect();

    return documents
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
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_tokenIdentifier", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier),
      )
      .unique();

    if (!user) {
      throw new Error("User not found");
    }

    const document = await verifyDocumentOwnership(
      ctx,
      args.documentId,
      user._id,
    );
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
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);

    const project = await ctx.db.get(args.projectId);
    if (!project) {
      throw new Error("Project not found");
    }

    if (project.userId !== user._id) {
      throw new Error("Unauthorized: you do not own this project");
    }

    const now = Date.now();

    const documentId = await ctx.db.insert("documents", {
      projectId: args.projectId,
      userId: user._id,
      title: args.title,
      slug: args.slug,
      content: "",
      status: args.status ?? "draft",
      createdAt: now,
      updatedAt: now,
      ...(args.tags !== undefined ? { tags: args.tags } : {}),
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
    scheduledAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    await verifyDocumentOwnership(ctx, args.documentId, user._id);

    const { documentId, ...updates } = args;
    const fieldsToUpdate: Record<string, unknown> = { updatedAt: Date.now() };

    for (const [key, value] of Object.entries(updates)) {
      if (value !== undefined) {
        fieldsToUpdate[key] = value;
      }
    }

    await ctx.db.patch(documentId, fieldsToUpdate);
  },
});

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
    const user = await getCurrentUser(ctx);
    const doc = await verifyDocumentOwnership(ctx, args.documentId, user._id);

    const now = Date.now();
    const newTitle = `${doc.title} (copy)`;
    const newSlug = `${doc.slug}-copy-${Date.now().toString(36)}`;

    const insertData: Record<string, unknown> = {
      projectId: doc.projectId,
      userId: user._id,
      title: newTitle,
      slug: newSlug,
      content: doc.content,
      status: doc.status,
      createdAt: now,
      updatedAt: now,
    };

    if (doc.frontmatter) {
      insertData["frontmatter"] = doc.frontmatter;
    }
    if (doc.tags) {
      insertData["tags"] = doc.tags;
    }

    // biome-ignore lint/suspicious/noExplicitAny: dynamic insert data
    const newId = await ctx.db.insert("documents", insertData as any);
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
    const user = await getCurrentUser(ctx);
    await verifyDocumentOwnership(ctx, args.documentId, user._id);

    const updates: Record<string, unknown> = {
      status: args.status,
      updatedAt: Date.now(),
    };

    if (args.status === "published") {
      updates["publishedAt"] = Date.now();
    }

    await ctx.db.patch(args.documentId, updates);
  },
});

/**
 * Deletes a document and all its associated scheduled publish records.
 * The cascade to scheduled_publishes prevents orphaned jobs from firing
 * after the document is gone.
 *
 * @requires Authentication + document ownership
 * @param args.documentId - The document to delete.
 */
export const remove = mutation({
  args: { documentId: v.id("documents") },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    await verifyDocumentOwnership(ctx, args.documentId, user._id);

    const scheduledPublishes = await ctx.db
      .query("scheduled_publishes")
      .withIndex("by_documentId", (q) => q.eq("documentId", args.documentId))
      .collect();

    for (const sp of scheduledPublishes) {
      await ctx.db.delete(sp._id);
    }

    await ctx.db.delete(args.documentId);
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
    const user = await getCurrentUser(ctx);

    const project = await ctx.db.get(args.projectId);
    if (!project) {
      throw new Error("Project not found");
    }
    if (project.userId !== user._id) {
      throw new Error("Unauthorized: you do not own this project");
    }

    // Check for duplicate import by githubPath
    const existing = await ctx.db
      .query("documents")
      .withIndex("by_projectId", (q) => q.eq("projectId", args.projectId))
      .collect();

    const duplicate = existing.find((d) => d.githubPath === args.githubPath);
    if (duplicate) {
      return duplicate._id;
    }

    const now = Date.now();

    const insertData: {
      projectId: typeof args.projectId;
      userId: typeof user._id;
      title: string;
      slug: string;
      content: string;
      status: string;
      githubPath: string;
      githubSha: string;
      githubSyncedAt: number;
      publishedAt: number;
      createdAt: number;
      updatedAt: number;
      frontmatter?: string;
    } = {
      projectId: args.projectId,
      userId: user._id,
      title: args.title,
      slug: args.slug,
      content: args.content,
      status: "published" as const,
      githubPath: args.githubPath,
      githubSha: args.githubSha,
      githubSyncedAt: now,
      publishedAt: now,
      createdAt: now,
      updatedAt: now,
    };

    if (args.frontmatter !== undefined) {
      insertData["frontmatter"] = args.frontmatter;
    }

    const documentId = await ctx.db.insert("documents", insertData);
    return documentId;
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
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return null;
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_tokenIdentifier", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier),
      )
      .unique();

    if (!user) {
      return null;
    }

    const project = await ctx.db.get(args.projectId);
    if (!project || project.userId !== user._id) {
      return null;
    }

    const documents = await ctx.db
      .query("documents")
      .withIndex("by_projectId", (q) => q.eq("projectId", args.projectId))
      .collect();

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
    const user = await getCurrentUser(ctx);
    const document = await verifyDocumentOwnership(
      ctx,
      args.documentId,
      user._id,
    );

    const updates: Record<string, unknown> = {
      status: args.targetStatus,
      boardPosition: args.boardPosition,
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
    githubSha: v.string(),
    status: v.string(),
    publishedAt: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.documentId, {
      githubPath: args.githubPath,
      githubSha: args.githubSha,
      githubSyncedAt: Date.now(),
      status: args.status,
      publishedAt: args.publishedAt,
      updatedAt: Date.now(),
    });
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
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const user = await ctx.db
      .query("users")
      .withIndex("by_tokenIdentifier", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier),
      )
      .unique();
    if (!user) return [];

    // Verify ownership
    const document = await ctx.db.get(args.documentId);
    if (!document) return [];
    const project = await ctx.db.get(document.projectId);
    if (!project || project.userId !== user._id) return [];

    const history = await ctx.db
      .query("publish_history")
      .withIndex("by_documentId", (q) => q.eq("documentId", args.documentId))
      .order("desc")
      .collect();

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
    const user = await getCurrentUser(ctx);

    const document = await ctx.db.get(args.documentId);
    if (!document) throw new Error("Document not found");
    const project = await ctx.db.get(document.projectId);
    if (!project || project.userId !== user._id) {
      throw new Error("Unauthorized");
    }

    const historyEntry = await ctx.db.get(args.historyId);
    if (!historyEntry || historyEntry.documentId !== args.documentId) {
      throw new Error("History entry not found or does not belong to this document");
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
