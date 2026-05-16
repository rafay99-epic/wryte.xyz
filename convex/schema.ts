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
import { compressionSettingsValidator } from "./_lib/compression";

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
    /**
     * Clerk-issued user identifier (e.g. "user_2abc..."), parsed once from
     * `tokenIdentifier` and pinned here so Convex Node actions can call
     * Clerk's backend SDK without reparsing on every request. Optional
     * because legacy users predate this field — backfilled lazily inside
     * `getCurrentUser` on the next authenticated request.
     */
    clerkUserId: v.optional(v.string()),
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
    /** Default author name injected into frontmatter for new posts. */
    defaultAuthor: v.optional(v.string()),
    /**
     * Default author avatar URL or media path injected into frontmatter for
     * new posts. Paired with `defaultAuthor` so the editor doesn't have to
     * re-derive these from the most-recently-detected post on every create.
     */
    defaultAuthorAvatar: v.optional(v.string()),
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
    /**
     * IANA timezone identifier (e.g. "America/New_York"). Drives how
     * scheduled publish times are interpreted and how the publish-date
     * frontmatter field is rendered. Absent = fall back to the editor's
     * browser timezone at schedule time.
     */
    timezone: v.optional(v.string()),
    /**
     * When false, the editor never persists changes automatically — the
     * author must use the manual save shortcut (Cmd/Ctrl+S). Absent =
     * auto-save enabled (default behaviour).
     */
    autoSaveEnabled: v.optional(v.boolean()),
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
    /**
     * How many days a soft-deleted document lingers in the project trash
     * before the cleanup cron hard-deletes it. Absent → 30 (the default
     * is read-side; we don't backfill). Set to a very large number to
     * effectively disable auto-cleanup ("Never").
     */
    trashRetentionDays: v.optional(v.number()),
    /**
     * Denormalized count of non-trashed documents in this project.
     * Maintained by document create/delete/trash/restore mutations so
     * `listWithDocumentCounts` avoids an O(N) scan per project.
     * Optional for backwards compat — absent means "not yet backfilled".
     */
    documentCount: v.optional(v.number()),
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
    /**
     * Soft-delete timestamp. When set, the document is in the project
     * trash — hidden from every user-facing query but retrievable until a
     * daily cleanup cron hard-deletes it after the project's
     * `trashRetentionDays`. Reuse `_lib/trash:isTrashed` instead of
     * comparing this field inline so the convention stays consistent.
     */
    trashedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_projectId", ["projectId"])
    .index("by_userId", ["userId"])
    .index("by_projectId_and_status", ["projectId", "status"])
    .index("by_status_and_scheduledAt", ["status", "scheduledAt"])
    // Drives the dedup-by-githubPath lookup in `importFromGithub` /
    // `_importFromGithubInternal`. Without it both have to `.collect()`
    // every document in the project to find a single match — a full
    // table scan per imported file. With the index it's an O(log n)
    // `.unique()` lookup.
    .index("by_projectId_and_githubPath", ["projectId", "githubPath"])
    // Powers the trash list view and the daily cleanup cron. Filtering
    // `trashedAt` server-side on the indexed range avoids a full project
    // scan for projects with thousands of active docs.
    .index("by_projectId_and_trashedAt", ["projectId", "trashedAt"]),

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
   * Draft snapshots — intentional checkpoints before publish. These are
   * separate from `documents.content` so autosave can keep the live working
   * copy lightweight while authors preserve v1/v2/final-candidate states.
   */
  document_drafts: defineTable({
    documentId: v.id("documents"),
    projectId: v.id("projects"),
    userId: v.id("users"),
    label: v.string(),
    contentSnapshot: v.string(),
    frontmatterSnapshot: v.optional(v.string()),
    titleSnapshot: v.string(),
    summary: v.optional(v.string()),
    wordCount: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_documentId", ["documentId"])
    .index("by_projectId", ["projectId"])
    .index("by_userId", ["userId"]),

  /**
   * Research/context notes attached to a document. `selectedForAi` lets the
   * editor build a deliberate context packet without sending every note.
   */
  document_research: defineTable({
    documentId: v.id("documents"),
    projectId: v.id("projects"),
    userId: v.id("users"),
    type: v.union(
      v.literal("note"),
      v.literal("source"),
      v.literal("quote"),
      v.literal("outline"),
      v.literal("idea"),
      v.literal("ai_summary"),
    ),
    title: v.string(),
    content: v.string(),
    url: v.optional(v.string()),
    sourceName: v.optional(v.string()),
    selectedForAi: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_documentId", ["documentId"])
    .index("by_projectId", ["projectId"])
    .index("by_userId", ["userId"])
    .index("by_documentId_and_selectedForAi", ["documentId", "selectedForAi"]),

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
   * Import batches — one row per bulk GitHub-to-Convex import. Jobs are
   * dispatched through `convex/importPool.ts`; the `onComplete` callback
   * increments `succeeded` or `failed` on this row so the UI can subscribe
   * via `documents:getImportBatch` and render live progress without
   * polling.
   *
   * `errors` is intentionally capped (see `convex/github.ts`) so a batch
   * with hundreds of failures doesn't grow this row past the document
   * size limit. The full error list lives in Convex logs when needed.
   */
  import_batches: defineTable({
    projectId: v.id("projects"),
    userId: v.id("users"),
    total: v.number(),
    // `succeeded`, `failed`, `errors` are legacy fields kept optional for
    // backwards compatibility with older rows. New writes never touch
    // them; counts are aggregated from `import_job_outcomes` to avoid
    // OCC contention when many parallel workpool callbacks try to bump
    // a shared counter (see https://docs.convex.dev/error#1).
    succeeded: v.optional(v.number()),
    failed: v.optional(v.number()),
    errors: v.optional(
      v.array(
        v.object({
          filePath: v.string(),
          message: v.string(),
        }),
      ),
    ),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_userId_and_createdAt", ["userId", "createdAt"])
    .index("by_projectId_and_createdAt", ["projectId", "createdAt"]),

  /**
   * Per-file outcome rows for a bulk import. One row per workpool job,
   * inserted by `_onImportFileComplete`. Splitting the counter across
   * rows eliminates the OCC hotspot that comes from N parallel callbacks
   * patching a single `import_batches` document.
   */
  import_job_outcomes: defineTable({
    batchId: v.id("import_batches"),
    status: v.union(v.literal("success"), v.literal("failure")),
    filePath: v.string(),
    errorMessage: v.optional(v.string()),
    createdAt: v.number(),
  }).index("by_batchId", ["batchId"]),

  /**
   * Delete batches — same shape as `import_batches` but for bulk deletes.
   * `mode` records what the user asked to delete ("local" wipes only the
   * Convex doc, "github" only touches the repo, "both" does both). Each
   * job is one item; the workpool's `onComplete` increments counters
   * here so the UI can stream progress without polling.
   */
  delete_batches: defineTable({
    projectId: v.id("projects"),
    userId: v.id("users"),
    mode: v.union(v.literal("local"), v.literal("github"), v.literal("both")),
    total: v.number(),
    // Same story as import_batches — optional legacy fields, counts
    // come from `delete_job_outcomes` to avoid the OCC hotspot.
    succeeded: v.optional(v.number()),
    failed: v.optional(v.number()),
    errors: v.optional(
      v.array(
        v.object({
          label: v.string(),
          message: v.string(),
        }),
      ),
    ),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_userId_and_createdAt", ["userId", "createdAt"])
    .index("by_projectId_and_createdAt", ["projectId", "createdAt"]),

  /** Per-item outcome rows for a bulk delete. Mirror of
   *  `import_job_outcomes`. */
  delete_job_outcomes: defineTable({
    batchId: v.id("delete_batches"),
    status: v.union(v.literal("success"), v.literal("failure")),
    label: v.string(),
    errorMessage: v.optional(v.string()),
    createdAt: v.number(),
  }).index("by_batchId", ["batchId"]),

  /**
   * Sync conflicts — one row per file where the diff-before-enqueue logic
   * in `startBulkImport` finds that GitHub's SHA has changed AND the local
   * doc has been edited since the last sync. Both versions are snapshotted
   * so the conflict UI shows a stable diff even if the user edits the
   * Convex doc after the conflict is raised.
   *
   * Resolution mutations in `convex/cms/conflicts.ts` patch
   * `documents.{content,frontmatter,githubSha,githubSyncedAt}` and mark
   * the row resolved. Resolved rows are kept for audit, hidden by the
   * `by_projectId_unresolved` index used by the banner / list queries.
   */
  sync_conflicts: defineTable({
    projectId: v.id("projects"),
    documentId: v.id("documents"),
    userId: v.id("users"),
    githubPath: v.string(),
    remoteSha: v.string(),
    remoteContent: v.string(),
    remoteFrontmatter: v.optional(v.string()),
    localContentSnapshot: v.string(),
    localFrontmatterSnapshot: v.optional(v.string()),
    detectedAt: v.number(),
    resolvedAt: v.optional(v.number()),
    resolution: v.optional(
      v.union(v.literal("github"), v.literal("convex"), v.literal("merge")),
    ),
  })
    .index("by_projectId", ["projectId"])
    .index("by_documentId", ["documentId"])
    .index("by_projectId_unresolved", ["projectId", "resolvedAt"]),

  /**
   * Scheduled publishes table — lightweight job queue for deferred publishing.
   * Pending → processing → completed | failed.
   */
  /**
   * Support tickets — user-submitted feedback, bug reports, or questions.
   *
   * `source` distinguishes where the ticket originated:
   *  - "dashboard": authenticated user from Settings → Support
   *  - "marketing": anonymous visitor from /contact
   *
   * Anonymous submissions populate `email` / `name` from the form.
   * Authenticated submissions populate them from the user record +
   * store the foreign key so past tickets are queryable per-user.
   */
  support_tickets: defineTable({
    userId: v.optional(v.id("users")),
    name: v.string(),
    email: v.string(),
    subject: v.string(),
    message: v.string(),
    status: v.union(
      v.literal("open"),
      v.literal("in_progress"),
      v.literal("resolved"),
      v.literal("closed"),
    ),
    source: v.union(v.literal("dashboard"), v.literal("marketing")),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_userId", ["userId"])
    .index("by_status", ["status"])
    .index("by_createdAt", ["createdAt"]),

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

  /**
   * Feature requests — community-submitted ideas for new functionality.
   *
   * Authoring requires a Clerk-authenticated user; the author's clerk
   * id is pinned on the row so admins can see who asked for what.
   * `upvoteCount` is denormalized off the join table so the public
   * sort-by-popularity query stays O(N) on `featureRequests` instead of
   * scanning every upvote row on every read.
   *
   * `status` is the public lifecycle — admins flip it as ideas move
   * from "open" through "in_progress" to "shipped" (or "declined").
   * Hidden statuses (spam, dupes) just get deleted outright.
   */
  feature_requests: defineTable({
    title: v.string(),
    description: v.string(),
    status: v.union(
      v.literal("open"),
      v.literal("planned"),
      v.literal("in_progress"),
      v.literal("shipped"),
      v.literal("declined"),
    ),
    authorClerkUserId: v.string(),
    authorName: v.string(),
    /** Denormalized count of rows in `feature_request_upvotes` for this id. */
    upvoteCount: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_status", ["status"])
    .index("by_upvoteCount", ["upvoteCount"])
    .index("by_status_and_upvoteCount", ["status", "upvoteCount"])
    .index("by_authorClerkUserId", ["authorClerkUserId"]),

  /**
   * Join rows — one per (user, feature request) pair. The composite
   * index lets the `toggleUpvote` mutation look up "has this user
   * already voted?" in one O(log n) read without scanning either side.
   */
  feature_request_upvotes: defineTable({
    featureRequestId: v.id("feature_requests"),
    clerkUserId: v.string(),
    createdAt: v.number(),
  })
    .index("by_featureRequestId", ["featureRequestId"])
    .index("by_user_and_request", ["clerkUserId", "featureRequestId"]),

  /**
   * Changelog entries — public release notes surfaced on the marketing
   * site. Authored by admins (gated by `publicMetadata.role === "admin"`
   * via the Clerk Backend SDK in `convex/integrations/clerk.ts`) and
   * rendered server-side with PPR so the marketing shell stays cached at
   * the edge while the list streams in from Convex per request.
   *
   * `version` is the human-readable release tag (e.g. "0.5.2") and
   * `build` is the build/commit identifier — both are free-form strings
   * because we don't enforce a versioning scheme. `publishedAt` is
   * optional so drafts can live in the admin UI without leaking to the
   * public list — the `by_publishedAt` index doubles as the public-only
   * filter (range over non-null values).
   */
  changelog: defineTable({
    title: v.string(),
    slug: v.string(),
    description: v.string(),
    content: v.string(),
    version: v.string(),
    build: v.string(),
    publishedAt: v.optional(v.number()),
    authorClerkUserId: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_slug", ["slug"])
    .index("by_publishedAt", ["publishedAt"]),
});
