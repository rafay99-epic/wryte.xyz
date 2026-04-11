/**
 * Database schema for the Wryte CMS backend.
 *
 * Core entities:
 * - users: Authenticated users linked via Clerk token identifiers
 * - projects: Writing projects that map to GitHub repositories
 * - documents: Markdown documents belonging to projects, with lifecycle tracking
 * - scheduled_publishes: Job queue for time-delayed publishing to GitHub
 */
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  /**
   * Users table — stores Clerk-authenticated user profiles.
   * `tokenIdentifier` is the Clerk-issued unique ID used to look up users on every request.
   * GitHub credentials are stored here so any project owned by the user can publish.
   */
  users: defineTable({
    tokenIdentifier: v.string(),
    name: v.string(),
    email: v.string(),
    imageUrl: v.optional(v.string()),
    githubAccessToken: v.optional(v.string()),
    githubUsername: v.optional(v.string()),
    createdAt: v.number(),
  }).index("by_tokenIdentifier", ["tokenIdentifier"]),

  /**
   * Projects table — each project corresponds to a writing workspace and optionally
   * maps to a GitHub repository for publishing. Users can configure content/media paths,
   * the target branch, and a frontmatter schema for consistent metadata across documents.
   * Relationship: projects.userId -> users._id (many-to-one)
   */
  projects: defineTable({
    userId: v.id("users"),
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
    /** Custom commit message template, e.g. "docs: update {{filename}}" */
    commitMessageTemplate: v.optional(v.string()),
    /** Filename pattern for new posts, e.g. "{{slug}}.md" or "{{date}}-{{slug}}.md" */
    filenamePattern: v.optional(v.string()),
    /** Whether new documents default to draft: true */
    defaultDraft: v.optional(v.boolean()),
    /** Site URL for preview links and canonical URLs */
    siteUrl: v.optional(v.string()),
    /** Webhook URL to trigger after publishing (e.g. Vercel/Netlify deploy hook) */
    deployHookUrl: v.optional(v.string()),
    /** Frontmatter delimiter format */
    frontmatterFormat: v.optional(
      v.union(v.literal("yaml"), v.literal("toml")),
    ),
    /** Default author name injected into frontmatter */
    defaultAuthor: v.optional(v.string()),
    /** JSON-serialized BoardColumnDef[] for custom kanban columns */
    boardColumns: v.optional(v.string()),
    /** AI provider for content enhancement: "anthropic" | "openai" | "openrouter" */
    aiProvider: v.optional(
      v.union(
        v.literal("anthropic"),
        v.literal("openai"),
        v.literal("openrouter"),
      ),
    ),
    /** AI model identifier, e.g. "claude-sonnet-4-20250514" */
    aiModel: v.optional(v.string()),
    /** User-starred project for quick scanning */
    isFavorite: v.optional(v.boolean()),
    /** Manual display order; set by reorder mutation (0 = first) */
    sortOrder: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_userId", ["userId"]),

  /**
   * Documents table — markdown documents with draft/scheduled/published lifecycle.
   * Each document belongs to exactly one project and one user.
   * `githubPath` and `githubSha` track the file's location and version in GitHub
   * to support updates (rather than creating duplicates) on subsequent publishes.
   *
   * Indexes:
   * - by_projectId: list all docs in a project
   * - by_projectId_and_status: filter docs by status within a project
   * - by_status_and_scheduledAt: used by the cron job to find documents due for publishing
   */
  documents: defineTable({
    projectId: v.id("projects"),
    userId: v.id("users"),
    title: v.string(),
    slug: v.string(),
    content: v.string(),
    frontmatter: v.optional(v.string()),
    status: v.string(),
    tags: v.optional(v.array(v.string())),
    boardPosition: v.optional(v.number()),
    scheduledAt: v.optional(v.number()),
    publishedAt: v.optional(v.number()),
    bookmarked: v.optional(v.boolean()),
    githubPath: v.optional(v.string()),
    githubSha: v.optional(v.string()),
    githubSyncedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_projectId", ["projectId"])
    .index("by_userId", ["userId"])
    .index("by_projectId_and_status", ["projectId", "status"])
    .index("by_status_and_scheduledAt", ["status", "scheduledAt"]),

  /**
   * Publish history table — tracks every publish to GitHub for a document.
   * Enables "Published N times" display and one-click rollback to any version.
   * Each record captures the full content snapshot so rollback doesn't require GitHub API.
   */
  publish_history: defineTable({
    documentId: v.id("documents"),
    projectId: v.id("projects"),
    userId: v.id("users"),
    /** Git commit SHA from the GitHub API response */
    commitSha: v.string(),
    /** Full GitHub commit URL for linking */
    commitUrl: v.optional(v.string()),
    /** The file path in the repo at publish time */
    githubPath: v.string(),
    /** Commit message used */
    commitMessage: v.string(),
    /** Snapshot of the document content at publish time (for rollback) */
    contentSnapshot: v.string(),
    /** Snapshot of frontmatter JSON at publish time */
    frontmatterSnapshot: v.optional(v.string()),
    /** Document title at publish time */
    titleSnapshot: v.string(),
    /** Whether this was a first publish or an update */
    isUpdate: v.boolean(),
    /** Whether this was part of a bulk publish */
    isBulk: v.optional(v.boolean()),
    /** Bulk publish batch ID (groups publishes from the same bulk operation) */
    bulkBatchId: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_documentId", ["documentId"])
    .index("by_projectId", ["projectId"])
    .index("by_bulkBatchId", ["bulkBatchId"]),

  /**
   * Media table — temporary staging for uploaded images.
   *
   * Images are stored in Convex file storage while documents are in draft/review/ready.
   * At publish time, images are uploaded to GitHub and deleted from Convex storage.
   * This prevents polluting the GitHub repo with images from unfinished drafts.
   */
  media: defineTable({
    projectId: v.id("projects"),
    /** Document this image is associated with (optional — can be project-level). */
    documentId: v.optional(v.id("documents")),
    /** Convex storage ID for the uploaded file. */
    storageId: v.id("_storage"),
    /** Original filename (e.g., "hero-image.png"). */
    fileName: v.string(),
    /** MIME type (e.g., "image/png"). */
    contentType: v.string(),
    /** File size in bytes. */
    size: v.number(),
    /** Whether this image has been synced to GitHub. */
    syncedToGithub: v.boolean(),
    /** The GitHub repo path after syncing (e.g., "public/images/hero.png"). */
    githubPath: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_projectId", ["projectId"])
    .index("by_documentId", ["documentId"])
    .index("by_storageId", ["storageId"]),

  /**
   * Scheduled publishes table — acts as a lightweight job queue for deferred publishing.
   * Each record tracks a single publish intent with a status lifecycle:
   * pending -> processing -> completed | failed.
   * The cron job in crons.ts polls this table every 5 minutes for due items.
   */
  scheduled_publishes: defineTable({
    documentId: v.id("documents"),
    scheduledAt: v.number(),
    status: v.union(
      v.literal("pending"),
      v.literal("processing"),
      v.literal("completed"),
      v.literal("failed"),
    ),
    error: v.optional(v.string()),
    workflowId: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_documentId", ["documentId"])
    .index("by_scheduledAt", ["scheduledAt"]),
});
