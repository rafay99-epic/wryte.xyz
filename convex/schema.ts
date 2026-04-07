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
    status: v.union(
      v.literal("draft"),
      v.literal("scheduled"),
      v.literal("published"),
    ),
    scheduledAt: v.optional(v.number()),
    publishedAt: v.optional(v.number()),
    githubPath: v.optional(v.string()),
    githubSha: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_projectId", ["projectId"])
    .index("by_userId", ["userId"])
    .index("by_projectId_and_status", ["projectId", "status"])
    .index("by_status_and_scheduledAt", ["status", "scheduledAt"]),

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
    createdAt: v.number(),
  })
    .index("by_documentId", ["documentId"])
    .index("by_scheduledAt", ["scheduledAt"]),
});
