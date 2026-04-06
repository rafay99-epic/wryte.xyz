import { v } from "convex/values";
import {
  query,
  mutation,
  internalQuery,
} from "./_generated/server";

/**
 * Helper to authenticate and retrieve the current user from the database.
 * Throws if the request is unauthenticated or the user record doesn't exist yet.
 * Used by mutations that require a confirmed user identity.
 */
async function getCurrentUser(ctx: { auth: { getUserIdentity: () => Promise<{ tokenIdentifier: string } | null> }; db: any }) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new Error("Not authenticated");
  }

  const user = await ctx.db
    .query("users")
    .withIndex("by_tokenIdentifier", (q: any) =>
      q.eq("tokenIdentifier", identity.tokenIdentifier),
    )
    .unique();

  if (!user) {
    throw new Error("User not found. Please sign in first.");
  }

  return user;
}

/**
 * Lists all projects owned by the current user, sorted by most recently updated.
 * Returns an empty array (instead of throwing) for unauthenticated users,
 * so the client can gracefully show an empty state.
 *
 * @returns Array of project documents, newest-updated first.
 */
export const list = query({
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

    const projects = await ctx.db
      .query("projects")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .collect();

    return projects.sort((a, b) => b.updatedAt - a.updatedAt);
  },
});

/**
 * Fetches a single project by ID with ownership verification.
 * Throws if the project doesn't exist or belongs to a different user,
 * preventing unauthorized access to project details.
 *
 * @requires Authentication
 * @param args.projectId - The project to retrieve.
 * @returns The project document.
 */
export const get = query({
  args: { projectId: v.id("projects") },
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

    const project = await ctx.db.get(args.projectId);
    if (!project) {
      throw new Error("Project not found");
    }

    if (project.userId !== user._id) {
      throw new Error("Unauthorized: you do not own this project");
    }

    return project;
  },
});

/**
 * Creates a new project for the authenticated user. Optional fields (GitHub config,
 * paths, frontmatter schema) are only set when provided, keeping the document lean
 * and avoiding undefined values in the database.
 *
 * @requires Authentication
 * @param args.name - Display name for the project.
 * @param args.slug - URL-safe identifier.
 * @param args.githubRepo - Optional "owner/repo" string for GitHub integration.
 * @returns The new project's document ID.
 */
export const create = mutation({
  args: {
    name: v.string(),
    slug: v.string(),
    githubRepo: v.optional(v.string()),
    githubBranch: v.optional(v.string()),
    contentPath: v.optional(v.string()),
    mediaPath: v.optional(v.string()),
    mediaStorageMode: v.optional(
      v.union(v.literal("github"), v.literal("external")),
    ),
    frontmatterSchema: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    const now = Date.now();

    const insertData: {
      userId: typeof user._id;
      name: string;
      slug: string;
      githubRepo?: string;
      githubBranch?: string;
      contentPath?: string;
      mediaPath?: string;
      mediaStorageMode?: "github" | "external";
      frontmatterSchema?: string;
      createdAt: number;
      updatedAt: number;
    } = {
      userId: user._id,
      name: args.name,
      slug: args.slug,
      createdAt: now,
      updatedAt: now,
    };

    if (args.githubRepo !== undefined) insertData.githubRepo = args.githubRepo;
    if (args.githubBranch !== undefined) insertData.githubBranch = args.githubBranch;
    if (args.contentPath !== undefined) insertData.contentPath = args.contentPath;
    if (args.mediaPath !== undefined) insertData.mediaPath = args.mediaPath;
    if (args.mediaStorageMode !== undefined) insertData.mediaStorageMode = args.mediaStorageMode;
    if (args.frontmatterSchema !== undefined) insertData.frontmatterSchema = args.frontmatterSchema;

    const projectId = await ctx.db.insert("projects", insertData);

    return projectId;
  },
});

/**
 * Partially updates a project's settings. Only provided fields are written,
 * and `updatedAt` is always refreshed. Verifies ownership before applying changes.
 *
 * @requires Authentication + project ownership
 * @param args.projectId - The project to update.
 */
export const update = mutation({
  args: {
    projectId: v.id("projects"),
    name: v.optional(v.string()),
    githubRepo: v.optional(v.string()),
    githubBranch: v.optional(v.string()),
    contentPath: v.optional(v.string()),
    mediaPath: v.optional(v.string()),
    mediaStorageMode: v.optional(
      v.union(v.literal("github"), v.literal("external")),
    ),
    frontmatterSchema: v.optional(v.string()),
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

    const { projectId, ...updates } = args;
    const fieldsToUpdate: Record<string, unknown> = { updatedAt: Date.now() };

    for (const [key, value] of Object.entries(updates)) {
      if (value !== undefined) {
        fieldsToUpdate[key] = value;
      }
    }

    await ctx.db.patch(projectId, fieldsToUpdate);
  },
});

/**
 * Deletes a project and cascades the deletion to all its documents and
 * their associated scheduled publishes. This is a destructive operation
 * with no undo — the cascade ensures no orphaned records remain.
 *
 * @requires Authentication + project ownership
 * @param args.projectId - The project to delete.
 */
export const remove = mutation({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    const project = await ctx.db.get(args.projectId);

    if (!project) {
      throw new Error("Project not found");
    }

    if (project.userId !== user._id) {
      throw new Error("Unauthorized: you do not own this project");
    }

    const documents = await ctx.db
      .query("documents")
      .withIndex("by_projectId", (q) => q.eq("projectId", args.projectId))
      .collect();

    for (const doc of documents) {
      const scheduledPublishes = await ctx.db
        .query("scheduled_publishes")
        .withIndex("by_documentId", (q) => q.eq("documentId", doc._id))
        .collect();

      for (const sp of scheduledPublishes) {
        await ctx.db.delete(sp._id);
      }

      await ctx.db.delete(doc._id);
    }

    await ctx.db.delete(args.projectId);
  },
});

/**
 * Internal-only query to fetch a project by ID without auth checks.
 * Used by server-side actions (github.ts, scheduling.ts) that operate
 * on behalf of the system after ownership has already been verified.
 */
export const internalGet = internalQuery({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.projectId);
  },
});
