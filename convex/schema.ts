/**
 * Database schema for the Wryte CMS backend.
 *
 * Core entities:
 * - users: Authenticated users linked via Clerk token identifiers
 * - projects: Writing projects that map to GitHub repositories
 * - documents: Markdown documents belonging to projects, with lifecycle tracking
 * - media: Records of images uploaded to the project's configured storage provider
 * - mediaCredentials: Per-project, encrypted credentials for UploadThing/Cloudinary (vault-backed)
 * - mediaUsage: Denormalized counters for cheap quota checks
 * - mediaErrorLog: Normalized error log for ops visibility and the UI
 * - scheduled_publishes: Job queue for time-delayed publishing to GitHub
 */
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { compressionSettingsValidator } from "./compressionSettings";

export default defineSchema({
  /**
   * Users table — stores Clerk-authenticated user profiles.
   * `tokenIdentifier` is the Clerk-issued unique ID used to look up users on every request.
   *
   * `githubAccessToken` is the legacy plaintext field — kept for one release so that
   * existing users can be lazily migrated into the vault on first read. New writes
   * go to `githubVaultSecretId`.
   */
  users: defineTable({
    tokenIdentifier: v.string(),
    name: v.string(),
    email: v.string(),
    imageUrl: v.optional(v.string()),
    /** @deprecated Use githubVaultSecretId. Cleared on lazy migration. */
    githubAccessToken: v.optional(v.string()),
    /** Opaque WorkOS Vault id for the user's GitHub PAT. */
    githubVaultSecretId: v.optional(v.string()),
    githubUsername: v.optional(v.string()),
    /**
     * Account-wide default for client-side image compression before upload.
     * Per-project `compressionSettings` overrides this when set; absent =
     * client falls back to `DEFAULT_COMPRESSION_SETTINGS` in
     * `src/lib/image-compression/defaults.ts`.
     */
    defaultCompressionSettings: v.optional(compressionSettingsValidator),
    createdAt: v.number(),
  }).index("by_tokenIdentifier", ["tokenIdentifier"]),

  /**
   * Projects table — each project corresponds to a writing workspace and optionally
   * maps to a GitHub repository for publishing. Users can configure content/media paths,
   * the target branch, and a frontmatter schema for consistent metadata across documents.
   *
   * `mediaStorageMode` picks the per-project upload destination:
   *  - "github": commit binaries directly into the project's repo at `mediaPath`
   *  - "uploadthing": user-provided UploadThing token (stored in vault)
   *  - "cloudinary": user-provided Cloudinary cloud_name + api_key + api_secret (secrets in vault)
   *
   * `mediaPath` carries the framework-specific destination — e.g. `public/images`
   * for Astro, `static/images` for SvelteKit, a Cloudinary folder, etc.
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
      v.union(
        v.literal("github"),
        v.literal("uploadthing"),
        v.literal("cloudinary"),
        // legacy value kept to allow non-destructive read; treat as "github" in code
        v.literal("external"),
      ),
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
    /**
     * Per-project override for image compression. When absent the client
     * inherits the user's `defaultCompressionSettings`. When that is also
     * absent, the built-in defaults apply.
     */
    compressionSettings: v.optional(compressionSettingsValidator),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_userId", ["userId"]),

  /**
   * Documents table — markdown documents with draft/scheduled/published lifecycle.
   * Each document belongs to exactly one project and one user.
   * `githubPath` and `githubSha` track the file's location and version in GitHub
   * to support updates (rather than creating duplicates) on subsequent publishes.
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
   */
  publish_history: defineTable({
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
    createdAt: v.number(),
  })
    .index("by_documentId", ["documentId"])
    .index("by_projectId", ["projectId"])
    .index("by_bulkBatchId", ["bulkBatchId"]),

  /**
   * Media table — records of images uploaded to a project's chosen storage provider.
   *
   * `provider` indicates where the binary lives:
   *  - "github": file lives at `externalId` (repo path) in the project's repo
   *  - "uploadthing": `externalId` is the UploadThing file key
   *  - "cloudinary": `externalId` is the Cloudinary public_id
   *  - "convex_legacy": legacy rows from the old staging flow; `storageId` is the Convex blob.
   *    Run `migrations/dropConvexMedia` to convert these to one of the active providers.
   */
  media: defineTable({
    projectId: v.id("projects"),
    userId: v.optional(v.id("users")),
    provider: v.optional(
      v.union(
        v.literal("github"),
        v.literal("uploadthing"),
        v.literal("cloudinary"),
        v.literal("convex_legacy"),
      ),
    ),
    externalId: v.optional(v.string()),
    url: v.optional(v.string()),
    filename: v.optional(v.string()),
    mime: v.optional(v.string()),
    bytes: v.optional(v.number()),
    width: v.optional(v.number()),
    height: v.optional(v.number()),
    documentId: v.optional(v.id("documents")),
    createdAt: v.number(),
    // ── Legacy fields (kept for in-flight rows being migrated) ──
    /** @deprecated convex_legacy provider only */
    storageId: v.optional(v.id("_storage")),
    /** @deprecated convex_legacy provider only */
    fileName: v.optional(v.string()),
    /** @deprecated convex_legacy provider only */
    contentType: v.optional(v.string()),
    /** @deprecated convex_legacy provider only */
    size: v.optional(v.number()),
    /** @deprecated convex_legacy provider only */
    syncedToGithub: v.optional(v.boolean()),
    /** @deprecated convex_legacy provider only */
    githubPath: v.optional(v.string()),
  })
    .index("by_projectId", ["projectId"])
    .index("by_userId", ["userId"])
    .index("by_projectId_and_createdAt", ["projectId", "createdAt"])
    .index("by_documentId", ["documentId"])
    .index("by_provider_and_externalId", ["provider", "externalId"])
    .index("by_storageId", ["storageId"]),

  /**
   * Media credentials — per-project encrypted credentials for the active provider.
   * Only one row per (projectId, provider). Secret values live in WorkOS Vault;
   * we store an opaque pointer plus non-secret hints (e.g. Cloudinary `cloud_name`).
   *
   * `status` is an explicit state machine so the UI can render
   * "verifying…" / "rotating…" / "invalid — please update" reactively.
   */
  mediaCredentials: defineTable({
    projectId: v.id("projects"),
    userId: v.id("users"),
    provider: v.union(v.literal("uploadthing"), v.literal("cloudinary")),
    vaultSecretId: v.string(),
    vaultVersionId: v.optional(v.string()),
    /** JSON-serialized non-secret hints, e.g. { cloudName, folder } for Cloudinary. */
    publicConfig: v.optional(v.string()),
    status: v.union(
      v.literal("active"),
      v.literal("verifying"),
      v.literal("invalid"),
      v.literal("rotating"),
    ),
    lastVerifiedAt: v.optional(v.number()),
    lastVerifyError: v.optional(v.string()),
    rotatedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_projectId", ["projectId"])
    .index("by_projectId_and_provider", ["projectId", "provider"])
    .index("by_userId_and_provider", ["userId", "provider"]),

  /**
   * AI provider credentials — per-project, encrypted in WorkOS Vault.
   *
   * Mirrors `mediaCredentials` exactly but for LLM provider keys
   * (Anthropic / OpenAI / OpenRouter). The project's `aiProvider` field
   * picks which row to use at call time; `aiModel` picks the model id.
   *
   * Only one row per (projectId, provider); insert-or-replace on save.
   */
  aiCredentials: defineTable({
    projectId: v.id("projects"),
    userId: v.id("users"),
    provider: v.union(
      v.literal("anthropic"),
      v.literal("openai"),
      v.literal("openrouter"),
    ),
    vaultSecretId: v.string(),
    vaultVersionId: v.optional(v.string()),
    status: v.union(
      v.literal("active"),
      v.literal("verifying"),
      v.literal("invalid"),
      v.literal("rotating"),
    ),
    lastVerifiedAt: v.optional(v.number()),
    lastVerifyError: v.optional(v.string()),
    rotatedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_projectId", ["projectId"])
    .index("by_projectId_and_provider", ["projectId", "provider"])
    .index("by_userId_and_provider", ["userId", "provider"]),

  /**
   * Media usage counters — denormalized so quota checks don't scan the media table
   * on every upload. Incremented in the same mutation that writes the media row,
   * decremented on delete. `uploadsThisMonth` resets when `monthBucket` rolls over.
   */
  mediaUsage: defineTable({
    projectId: v.id("projects"),
    userId: v.id("users"),
    fileCount: v.number(),
    totalBytes: v.number(),
    uploadsThisMonth: v.number(),
    monthBucket: v.string(),
    updatedAt: v.number(),
  })
    .index("by_projectId", ["projectId"])
    .index("by_userId", ["userId"]),

  /**
   * Normalized error log for media operations. One row per failed upload /
   * delete / list / ping, mapped to a closed `MediaErrorCode` enum so the UI
   * can render friendly toasts. Pruned by a daily cron after 30 days.
   */
  mediaErrorLog: defineTable({
    projectId: v.id("projects"),
    userId: v.id("users"),
    provider: v.string(),
    operation: v.string(),
    errorCode: v.string(),
    errorMessage: v.string(),
    /** Raw provider error JSON (redacted of secrets) for debugging. */
    providerError: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_projectId_and_createdAt", ["projectId", "createdAt"])
    .index("by_userId_and_createdAt", ["userId", "createdAt"]),

  /**
   * Scheduled publishes table — lightweight job queue for deferred publishing.
   * Pending → processing → completed | failed.
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
