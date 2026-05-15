import { v } from "convex/values";
import type { Doc } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import {
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "../_generated/server";
import { getAuthedUserOrNull, getCurrentUser } from "../_lib/auth";
import { compressionSettingsValidator } from "../_lib/compression";
import { getRateLimitKey, rateLimiter } from "../_lib/rateLimits";
import { cascadeDeleteScheduledPublishesForDoc } from "./documents";

function sortProjectsForList(projects: Doc<"projects">[]): Doc<"projects">[] {
  const hasAnySortOrder = projects.some((p) => p.sortOrder !== undefined);
  if (!hasAnySortOrder) {
    return [...projects].sort((a, b) => b.updatedAt - a.updatedAt);
  }

  const withOrder = projects
    .filter((p) => p.sortOrder !== undefined)
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  const withoutOrder = projects
    .filter((p) => p.sortOrder === undefined)
    .sort((a, b) => b.updatedAt - a.updatedAt);
  return [...withOrder, ...withoutOrder];
}

/** Sorted projects for the signed-in user, or [] if unauthenticated / no user row. */
async function projectsForCurrentUserOrEmpty(
  ctx: QueryCtx,
): Promise<Doc<"projects">[]> {
  const user = await getAuthedUserOrNull(ctx);
  if (!user) return [];

  const projects = await ctx.db
    .query("projects")
    .withIndex("by_userId", (q) => q.eq("userId", user._id))
    .collect();

  return sortProjectsForList(projects);
}

/**
 * Lists all projects owned by the current user.
 * If no project has `sortOrder`, sorts by most recently updated (legacy behavior).
 * Once any project has `sortOrder`, ordered projects sort ascending by `sortOrder`,
 * then projects without `sortOrder` follow, sorted by `updatedAt` descending.
 *
 * @returns Array of project documents.
 */
export const list = query({
  args: {},
  handler: async (ctx) => {
    return await projectsForCurrentUserOrEmpty(ctx);
  },
});

/**
 * Same ordering as {@link list}, plus `documentCount` per project in one query.
 * Prefer this on the projects dashboard so the client opens a single Convex
 * subscription instead of one `documents.list` subscription per card.
 */
export const listWithDocumentCounts = query({
  args: {},
  handler: async (ctx) => {
    const sorted = await projectsForCurrentUserOrEmpty(ctx);
    return sorted.map((p) => ({
      ...p,
      documentCount: p.documentCount ?? 0,
    }));
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
    const user = await getAuthedUserOrNull(ctx);
    if (!user) {
      throw new Error("Not authenticated");
    }

    const project = await ctx.db.get(args.projectId);
    if (!project) {
      return null;
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
      v.union(
        v.literal("github"),
        v.literal("uploadthing"),
        v.literal("cloudinary"),
        v.literal("external"),
      ),
    ),
    frontmatterSchema: v.optional(v.string()),
    commitMessageTemplate: v.optional(v.string()),
    filenamePattern: v.optional(v.string()),
    defaultDraft: v.optional(v.boolean()),
    siteUrl: v.optional(v.string()),
    deployHookUrl: v.optional(v.string()),
    frontmatterFormat: v.optional(
      v.union(v.literal("yaml"), v.literal("toml")),
    ),
    defaultAuthor: v.optional(v.string()),
    defaultAuthorAvatar: v.optional(v.string()),
    aiProvider: v.optional(
      v.union(
        v.literal("anthropic"),
        v.literal("openai"),
        v.literal("openrouter"),
      ),
    ),
    aiModel: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const key = await getRateLimitKey(ctx);
    await rateLimiter.limit(ctx, "projects:create", { key, throws: true });

    const user = await getCurrentUser(ctx);
    const now = Date.now();

    const existing = await ctx.db
      .query("projects")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .collect();
    const anyOrdered = existing.some((p) => p.sortOrder !== undefined);

    const insertData: {
      userId: typeof user._id;
      name: string;
      slug: string;
      githubRepo?: string;
      githubBranch?: string;
      contentPath?: string;
      mediaPath?: string;
      mediaStorageMode?: "github" | "uploadthing" | "cloudinary" | "external";
      frontmatterSchema?: string;
      commitMessageTemplate?: string;
      filenamePattern?: string;
      defaultDraft?: boolean;
      siteUrl?: string;
      deployHookUrl?: string;
      frontmatterFormat?: "yaml" | "toml";
      defaultAuthor?: string;
      defaultAuthorAvatar?: string;
      aiProvider?: "anthropic" | "openai" | "openrouter";
      aiModel?: string;
      sortOrder?: number;
      createdAt: number;
      updatedAt: number;
    } = {
      userId: user._id,
      name: args.name,
      slug: args.slug,
      createdAt: now,
      updatedAt: now,
    };

    if (anyOrdered) {
      const maxOrder = existing.reduce(
        (m, p) => Math.max(m, p.sortOrder ?? -1),
        -1,
      );
      insertData.sortOrder = maxOrder + 1;
    }

    if (args.githubRepo !== undefined) insertData.githubRepo = args.githubRepo;
    if (args.githubBranch !== undefined)
      insertData.githubBranch = args.githubBranch;
    if (args.contentPath !== undefined)
      insertData.contentPath = args.contentPath;
    if (args.mediaPath !== undefined) insertData.mediaPath = args.mediaPath;
    if (args.mediaStorageMode !== undefined)
      insertData.mediaStorageMode = args.mediaStorageMode;
    if (args.frontmatterSchema !== undefined)
      insertData.frontmatterSchema = args.frontmatterSchema;
    if (args.commitMessageTemplate !== undefined)
      insertData.commitMessageTemplate = args.commitMessageTemplate;
    if (args.filenamePattern !== undefined)
      insertData.filenamePattern = args.filenamePattern;
    if (args.defaultDraft !== undefined)
      insertData.defaultDraft = args.defaultDraft;
    if (args.siteUrl !== undefined) insertData.siteUrl = args.siteUrl;
    if (args.deployHookUrl !== undefined)
      insertData.deployHookUrl = args.deployHookUrl;
    if (args.frontmatterFormat !== undefined)
      insertData.frontmatterFormat = args.frontmatterFormat;
    if (args.defaultAuthor !== undefined)
      insertData.defaultAuthor = args.defaultAuthor;
    if (args.defaultAuthorAvatar !== undefined)
      insertData.defaultAuthorAvatar = args.defaultAuthorAvatar;
    if (args.aiProvider !== undefined) insertData.aiProvider = args.aiProvider;
    if (args.aiModel !== undefined) insertData.aiModel = args.aiModel;

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
      v.union(
        v.literal("github"),
        v.literal("uploadthing"),
        v.literal("cloudinary"),
        v.literal("external"),
      ),
    ),
    frontmatterSchema: v.optional(v.string()),
    commitMessageTemplate: v.optional(v.string()),
    filenamePattern: v.optional(v.string()),
    defaultDraft: v.optional(v.boolean()),
    siteUrl: v.optional(v.string()),
    deployHookUrl: v.optional(v.string()),
    frontmatterFormat: v.optional(
      v.union(v.literal("yaml"), v.literal("toml")),
    ),
    defaultAuthor: v.optional(v.string()),
    defaultAuthorAvatar: v.optional(v.string()),
    boardColumns: v.optional(v.string()),
    aiProvider: v.optional(
      v.union(
        v.literal("anthropic"),
        v.literal("openai"),
        v.literal("openrouter"),
      ),
    ),
    aiModel: v.optional(v.string()),
    timezone: v.optional(v.string()),
    autoSaveEnabled: v.optional(v.boolean()),
    isFavorite: v.optional(v.boolean()),
    sortOrder: v.optional(v.number()),
    /**
     * Pass an object to set the per-project override, or `null` to clear it
     * and inherit the user's `defaultCompressionSettings` again.
     */
    compressionSettings: v.optional(
      v.union(compressionSettingsValidator, v.null()),
    ),
    /**
     * How many days soft-deleted docs sit in trash before the daily
     * cleanup cron hard-deletes them. Setting to a very large number
     * (e.g. 36500 for "100 years") is the UX for "Never auto-cleanup".
     */
    trashRetentionDays: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const key = await getRateLimitKey(ctx);
    await rateLimiter.limit(ctx, "projects:update", { key, throws: true });

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

    for (const [k, value] of Object.entries(updates)) {
      if (value === undefined) continue;
      // `null` for compressionSettings is the explicit "clear" signal —
      // patch with `undefined` to remove the optional field from the doc.
      if (k === "compressionSettings" && value === null) {
        fieldsToUpdate["compressionSettings"] = undefined;
        continue;
      }
      fieldsToUpdate[k] = value;
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
    const key = await getRateLimitKey(ctx);
    await rateLimiter.limit(ctx, "projects:remove", { key, throws: true });

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
      await cascadeDeleteScheduledPublishesForDoc(ctx, doc._id);
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

/**
 * One-shot backfill: computes and sets `documentCount` for every project.
 * Run from the Convex dashboard after deploying the schema change.
 * Idempotent — safe to re-run.
 */
export const _backfillDocumentCounts = internalMutation({
  args: {},
  handler: async (ctx) => {
    const projects = await ctx.db.query("projects").collect();
    let updated = 0;
    for (const p of projects) {
      const docs = await ctx.db
        .query("documents")
        .withIndex("by_projectId", (q) => q.eq("projectId", p._id))
        .take(1000);
      const count = docs.filter((d) => d.trashedAt === undefined).length;
      if (p.documentCount !== count) {
        await ctx.db.patch(p._id, { documentCount: count });
        updated += 1;
      }
    }
    return { total: projects.length, updated };
  },
});
