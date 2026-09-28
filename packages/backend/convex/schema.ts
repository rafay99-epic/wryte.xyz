import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { compressionSettingsValidator } from "./_lib/compression";
import { providerValidator } from "./ai/_lib/providers";
import {
  credentialProviderValidator,
  mediaProviderValidator,
} from "./media/_lib/providers";

export default defineSchema({
  app_version: defineTable({
    version: v.string(),
    build: v.string(),
    deployedAt: v.number(),
  }),

  users: defineTable({
    tokenIdentifier: v.string(),
    clerkUserId: v.optional(v.string()),
    name: v.string(),
    email: v.string(),
    imageUrl: v.optional(v.string()),
    githubVaultSecretId: v.optional(v.string()),
    githubUsername: v.optional(v.string()),
    username: v.optional(v.string()),
    bio: v.optional(v.string()),
    socialLinks: v.optional(v.string()),
    profilePublic: v.optional(v.boolean()),
    profileShowStats: v.optional(v.boolean()),
    profileAccent: v.optional(v.string()),
    feedUrl: v.optional(v.string()),
    featuredDocumentId: v.optional(v.id("documents")),
    profilePreviewToken: v.optional(v.string()),
    defaultCompressionSettings: v.optional(compressionSettingsValidator),
    mcpScopes: v.optional(v.array(v.string())),
    createdAt: v.number(),
  })
    .index("by_tokenIdentifier", ["tokenIdentifier"])
    .index("by_clerkUserId", ["clerkUserId"])
    .index("by_username", ["username"]),

  projects: defineTable({
    userId: v.id("users"),
    name: v.string(),
    slug: v.string(),
    githubRepo: v.optional(v.string()),
    githubBranch: v.optional(v.string()),
    contentPath: v.optional(v.string()),
    mediaPath: v.optional(v.string()),
    animationsPath: v.optional(v.string()),
    animationsEnabled: v.optional(v.boolean()),
    animationLanguage: v.optional(v.union(v.literal("tsx"), v.literal("jsx"))),
    animationChecks: v.optional(
      v.object({
        level: v.union(
          v.literal("off"),
          v.literal("contract"),
          v.literal("strict"),
        ),
        blockPublish: v.boolean(),
      }),
    ),
    importEnabled: v.optional(v.boolean()),
    mediaStorageMode: v.optional(mediaProviderValidator),
    frontmatterSchema: v.optional(v.string()),
    commitMessageTemplate: v.optional(v.string()),
    commitAttribution: v.optional(v.boolean()),
    commitAttributionText: v.optional(v.string()),
    verifiedCommits: v.optional(v.boolean()),
    filenamePattern: v.optional(v.string()),
    contentFormat: v.optional(v.union(v.literal("md"), v.literal("mdx"))),
    defaultDraft: v.optional(v.boolean()),
    siteUrl: v.optional(v.string()),
    postUrlPrefix: v.optional(v.string()),
    deployHookUrl: v.optional(v.string()),
    frontmatterFormat: v.optional(
      v.union(v.literal("yaml"), v.literal("toml")),
    ),
    framework: v.optional(v.string()),
    defaultAuthor: v.optional(v.string()),
    defaultAuthorAvatar: v.optional(v.string()),
    boardColumns: v.optional(v.string()),
    aiProvider: v.optional(providerValidator),
    aiModel: v.optional(v.string()),
    aiPromptTemplates: v.optional(v.string()),
    socialPostOnPublish: v.optional(v.boolean()),
    syndicateOnPublish: v.optional(v.boolean()),
    deployVerificationEnabled: v.optional(v.boolean()),
    readabilityLensEnabled: v.optional(v.boolean()),
    autoWatermarkRemoval: v.optional(v.boolean()),
    slashCommandsEnabled: v.optional(v.boolean()),
    snippetsEnabled: v.optional(v.boolean()),
    selectionToolbarEnabled: v.optional(v.boolean()),
    snippetCount: v.optional(v.number()),
    timezone: v.optional(v.string()),
    autoSaveEnabled: v.optional(v.boolean()),
    isFavorite: v.optional(v.boolean()),
    sortOrder: v.optional(v.number()),
    compressionSettings: v.optional(compressionSettingsValidator),
    maxUploadBytes: v.optional(v.number()),
    trashRetentionDays: v.optional(v.number()),
    documentCount: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_userId", ["userId"]),

  documents: defineTable({
    projectId: v.id("projects"),
    userId: v.id("users"),
    title: v.string(),
    slug: v.string(),
    excerpt: v.optional(v.string()),
    contentId: v.optional(v.id("document_content")),
    wordCount: v.optional(v.number()),
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
    trashedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_projectId", ["projectId"])
    .index("by_userId", ["userId"])
    .index("by_userId_and_status", ["userId", "status"])
    .index("by_projectId_and_status", ["projectId", "status"])
    .index("by_projectId_and_githubPath", ["projectId", "githubPath"])
    .index("by_projectId_and_slug", ["projectId", "slug"])
    .index("by_projectId_and_trashedAt", ["projectId", "trashedAt"])
    .searchIndex("search_title", {
      searchField: "title",
      filterFields: ["projectId", "userId"],
    }),

  document_content: defineTable({
    documentId: v.id("documents"),
    projectId: v.id("projects"),
    userId: v.id("users"),
    content: v.string(),
    updatedAt: v.number(),
  })
    .index("by_documentId", ["documentId"])
    .index("by_projectId", ["projectId"])
    .index("by_userId", ["userId"])
    .searchIndex("search_content", {
      searchField: "content",
      filterFields: ["userId", "projectId"],
    }),

  document_links: defineTable({
    sourceDocumentId: v.id("documents"),
    targetDocumentId: v.id("documents"),
    projectId: v.id("projects"),
    userId: v.id("users"),
    createdAt: v.number(),
  })
    .index("by_sourceDocumentId", ["sourceDocumentId"])
    .index("by_targetDocumentId", ["targetDocumentId"])
    .index("by_projectId", ["projectId"])
    .index("by_userId", ["userId"]),

  publish_history: defineTable({
    documentId: v.id("documents"),
    projectId: v.id("projects"),
    userId: v.id("users"),
    commitSha: v.string(),
    commitUrl: v.optional(v.string()),
    githubPath: v.string(),
    commitMessage: v.string(),
    frontmatterSnapshot: v.optional(v.string()),
    titleSnapshot: v.string(),
    isUpdate: v.boolean(),
    isBulk: v.optional(v.boolean()),
    bulkBatchId: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_documentId", ["documentId"])
    .index("by_projectId", ["projectId"]),

  publish_history_content: defineTable({
    publishId: v.id("publish_history"),
    documentId: v.id("documents"),
    projectId: v.id("projects"),
    userId: v.id("users"),
    content: v.string(),
    frontmatter: v.optional(v.string()),
  })
    .index("by_publishId", ["publishId"])
    .index("by_documentId", ["documentId"])
    .index("by_projectId", ["projectId"])
    .index("by_userId", ["userId"]),

  document_drafts: defineTable({
    documentId: v.id("documents"),
    projectId: v.id("projects"),
    userId: v.id("users"),
    label: v.string(),
    frontmatterSnapshot: v.optional(v.string()),
    contentId: v.optional(v.id("document_draft_content")),
    summary: v.optional(v.string()),
    wordCount: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_documentId", ["documentId"])
    .index("by_projectId", ["projectId"])
    .index("by_userId", ["userId"]),

  document_draft_content: defineTable({
    draftId: v.id("document_drafts"),
    documentId: v.id("documents"),
    projectId: v.id("projects"),
    userId: v.id("users"),
    title: v.string(),
    content: v.string(),
    updatedAt: v.number(),
  })
    .index("by_draftId", ["draftId"])
    .index("by_documentId", ["documentId"])
    .index("by_projectId", ["projectId"])
    .index("by_userId", ["userId"]),

  document_snapshots: defineTable({
    documentId: v.id("documents"),
    projectId: v.id("projects"),
    userId: v.id("users"),
    reason: v.union(
      v.literal("manual"),
      v.literal("interval"),
      v.literal("restore"),
    ),
    title: v.string(),
    contentHash: v.optional(v.string()),
    wordCount: v.number(),
    createdAt: v.number(),
  })
    .index("by_documentId", ["documentId"])
    .index("by_projectId", ["projectId"]),

  document_snapshot_content: defineTable({
    snapshotId: v.id("document_snapshots"),
    documentId: v.id("documents"),
    projectId: v.id("projects"),
    userId: v.id("users"),
    content: v.string(),
  })
    .index("by_snapshotId", ["snapshotId"])
    .index("by_documentId", ["documentId"])
    .index("by_projectId", ["projectId"])
    .index("by_userId", ["userId"]),

  share_links: defineTable({
    documentId: v.id("documents"),
    projectId: v.id("projects"),
    userId: v.id("users"),
    token: v.string(),
    createdAt: v.number(),
    revokedAt: v.optional(v.number()),
  })
    .index("by_token", ["token"])
    .index("by_documentId", ["documentId"])
    .index("by_projectId", ["projectId"]),

  ideas: defineTable({
    projectId: v.id("projects"),
    userId: v.id("users"),
    title: v.string(),
    note: v.optional(v.string()),
    createdAt: v.number(),
  }).index("by_projectId", ["projectId"]),

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

  media: defineTable({
    projectId: v.id("projects"),
    userId: v.optional(v.id("users")),
    provider: v.optional(mediaProviderValidator),
    externalId: v.optional(v.string()),
    url: v.optional(v.string()),
    filename: v.optional(v.string()),
    mime: v.optional(v.string()),
    bytes: v.optional(v.number()),
    width: v.optional(v.number()),
    height: v.optional(v.number()),
    documentId: v.optional(v.id("documents")),
    createdAt: v.number(),
  })
    .index("by_projectId", ["projectId"])
    .index("by_userId", ["userId"])
    .index("by_projectId_and_createdAt", ["projectId", "createdAt"])
    .index("by_documentId", ["documentId"])
    .index("by_provider_and_externalId", ["provider", "externalId"]),

  mcp_upload_tickets: defineTable({
    token: v.string(),
    userId: v.id("users"),
    projectId: v.id("projects"),
    documentId: v.optional(v.id("documents")),
    filename: v.optional(v.string()),
    alt: v.optional(v.string()),
    expiresAt: v.number(),
  })
    .index("by_token", ["token"])
    .index("by_userId_and_expiresAt", ["userId", "expiresAt"]),

  mediaCredentials: defineTable({
    projectId: v.id("projects"),
    userId: v.id("users"),
    provider: credentialProviderValidator,
    vaultSecretId: v.string(),
    vaultVersionId: v.optional(v.string()),
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

  aiCredentials: defineTable({
    projectId: v.id("projects"),
    userId: v.id("users"),
    provider: providerValidator,
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

  socialCredentials: defineTable({
    projectId: v.id("projects"),
    userId: v.id("users"),
    provider: v.union(v.literal("upload-post"), v.literal("buffer")),
    vaultSecretId: v.string(),
    vaultVersionId: v.optional(v.string()),
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

  social_posts: defineTable({
    projectId: v.id("projects"),
    documentId: v.id("documents"),
    channelId: v.string(),
    service: v.string(),
    channelName: v.string(),
    text: v.string(),
    status: v.union(v.literal("posted"), v.literal("failed")),
    error: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_documentId", ["documentId"])
    .index("by_projectId", ["projectId"]),

  syndicationCredentials: defineTable({
    projectId: v.id("projects"),
    userId: v.id("users"),
    provider: v.union(v.literal("devto"), v.literal("hashnode")),
    vaultSecretId: v.string(),
    vaultVersionId: v.optional(v.string()),
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

  syndication_posts: defineTable({
    projectId: v.id("projects"),
    documentId: v.id("documents"),
    provider: v.union(v.literal("devto"), v.literal("hashnode")),
    status: v.union(
      v.literal("pending"),
      v.literal("posted"),
      v.literal("failed"),
    ),
    remoteId: v.optional(v.string()),
    remoteUrl: v.optional(v.string()),
    errorCode: v.optional(v.string()),
    errorMessage: v.optional(v.string()),
    attempt: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_documentId", ["documentId"])
    .index("by_documentId_and_provider", ["documentId", "provider"])
    .index("by_projectId", ["projectId"]),

  analytics_targets: defineTable({
    projectId: v.id("projects"),
    userId: v.id("users"),
    provider: v.union(v.literal("plausible"), v.literal("umami")),
    mode: v.optional(v.union(v.literal("api"), v.literal("share"))),
    vaultSecretId: v.optional(v.string()),
    shareUrl: v.optional(v.string()),
    embedBlocked: v.optional(v.boolean()),
    baseUrl: v.optional(v.string()),
    siteId: v.string(),
    enabled: v.optional(v.boolean()),
    status: v.union(v.literal("active"), v.literal("invalid")),
    lastError: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_projectId", ["projectId"]),

  analytics_snapshots: defineTable({
    projectId: v.id("projects"),
    range: v.string(),
    fetchedAt: v.number(),
    totalsJson: v.string(),
    pagesJson: v.string(),
  }).index("by_projectId", ["projectId"]),

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

  mediaErrorLog: defineTable({
    projectId: v.id("projects"),
    userId: v.id("users"),
    provider: v.string(),
    operation: v.string(),
    errorCode: v.string(),
    errorMessage: v.string(),
    providerError: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_projectId_and_createdAt", ["projectId", "createdAt"])
    .index("by_userId_and_createdAt", ["userId", "createdAt"]),

  import_batches: defineTable({
    projectId: v.id("projects"),
    userId: v.id("users"),
    total: v.number(),
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

  import_job_outcomes: defineTable({
    batchId: v.id("import_batches"),
    status: v.union(v.literal("success"), v.literal("failure")),
    filePath: v.string(),
    errorMessage: v.optional(v.string()),
    createdAt: v.number(),
  }).index("by_batchId", ["batchId"]),

  delete_batches: defineTable({
    projectId: v.id("projects"),
    userId: v.id("users"),
    mode: v.union(v.literal("local"), v.literal("github"), v.literal("both")),
    total: v.number(),
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

  delete_job_outcomes: defineTable({
    batchId: v.id("delete_batches"),
    status: v.union(v.literal("success"), v.literal("failure")),
    label: v.string(),
    errorMessage: v.optional(v.string()),
    createdAt: v.number(),
  }).index("by_batchId", ["batchId"]),

  sync_conflicts: defineTable({
    projectId: v.id("projects"),
    documentId: v.id("documents"),
    userId: v.id("users"),
    githubPath: v.string(),
    remoteSha: v.string(),
    remoteContent: v.optional(v.string()),
    remoteFrontmatter: v.optional(v.string()),
    localContentSnapshot: v.optional(v.string()),
    localFrontmatterSnapshot: v.optional(v.string()),
    detectedAt: v.number(),
    resolvedAt: v.optional(v.number()),
    resolution: v.optional(
      v.union(v.literal("github"), v.literal("convex"), v.literal("merge")),
    ),
  })
    .index("by_projectId", ["projectId"])
    .index("by_documentId", ["documentId"])
    .index("by_documentId_unresolved", ["documentId", "resolvedAt"])
    .index("by_projectId_unresolved", ["projectId", "resolvedAt"]),

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
  }).index("by_userId", ["userId"]),

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
    socialPostText: v.optional(v.string()),
    createdAt: v.number(),
  }).index("by_documentId", ["documentId"]),

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
    upvoteCount: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_upvoteCount", ["upvoteCount"])
    .index("by_status_and_upvoteCount", ["status", "upvoteCount"]),

  feature_request_upvotes: defineTable({
    featureRequestId: v.id("feature_requests"),
    clerkUserId: v.string(),
    createdAt: v.number(),
  })
    .index("by_featureRequestId", ["featureRequestId"])
    .index("by_user_and_request", ["clerkUserId", "featureRequestId"]),

  writing_stats: defineTable({
    userId: v.id("users"),
    currentStreak: v.number(),
    longestStreak: v.number(),
    lastActiveDate: v.string(),
    wordsToday: v.number(),
    todayDate: v.string(),
    dailyWordGoal: v.optional(v.number()),
    weeklyWordGoal: v.optional(v.number()),
    totalWords: v.number(),
    totalPublished: v.number(),
    recentActivity: v.array(v.object({ date: v.string(), words: v.number() })),
    timezone: v.optional(v.string()),
    updatedAt: v.number(),
  }).index("by_userId", ["userId"]),

  project_stats: defineTable({
    projectId: v.id("projects"),
    userId: v.id("users"),
    totalWords: v.number(),
    draftCount: v.number(),
    reviewCount: v.number(),
    readyCount: v.number(),
    scheduledCount: v.number(),
    publishedCount: v.number(),
    updatedAt: v.number(),
  })
    .index("by_projectId", ["projectId"])
    .index("by_userId", ["userId"]),

  ai_stream_owners: defineTable({
    streamId: v.string(),
    userId: v.id("users"),
    projectId: v.id("projects"),
    createdAt: v.number(),
  })
    .index("by_streamId", ["streamId"])
    .index("by_userId_and_createdAt", ["userId", "createdAt"])
    .index("by_projectId", ["projectId"])
    .index("by_createdAt", ["createdAt"]),

  snippets: defineTable({
    projectId: v.id("projects"),
    name: v.string(),
    content: v.string(),
    updatedAt: v.number(),
  })
    .index("by_project", ["projectId"])
    .searchIndex("search_name", {
      searchField: "name",
      filterFields: ["projectId"],
    }),

  animations: defineTable({
    projectId: v.id("projects"),
    name: v.string(),
    source: v.string(),
    updatedAt: v.number(),
    check: v.optional(
      v.object({
        sourceHash: v.string(),
        status: v.union(
          v.literal("pass"),
          v.literal("warn"),
          v.literal("fail"),
        ),
        errorCount: v.number(),
        warningCount: v.number(),
        checkedAt: v.number(),
      }),
    ),
  })
    .index("by_project", ["projectId"])
    .index("by_project_and_name", ["projectId", "name"]),

  animation_names: defineTable({
    projectId: v.id("projects"),
    name: v.string(),
  })
    .index("by_project", ["projectId"])
    .index("by_project_and_name", ["projectId", "name"]),

  deployment_targets: defineTable({
    projectId: v.id("projects"),
    userId: v.id("users"),
    provider: v.union(v.literal("vercel")),
    providerProjectId: v.string(),
    teamId: v.optional(v.string()),
    vaultSecretId: v.string(),
    enabled: v.boolean(),
    createdAt: v.number(),
  }).index("by_projectId", ["projectId"]),

  deploy_verifications: defineTable({
    projectId: v.id("projects"),
    documentId: v.id("documents"),
    userId: v.id("users"),
    targetId: v.optional(v.id("deployment_targets")),
    method: v.union(v.literal("vercel"), v.literal("url_poll")),
    commitSha: v.string(),
    commitUrl: v.optional(v.string()),
    publishedUrl: v.optional(v.string()),
    documentTitle: v.string(),
    status: v.union(
      v.literal("pending"),
      v.literal("deployed"),
      v.literal("failed"),
      v.literal("timeout"),
    ),
    failReason: v.optional(v.string()),
    deploymentUrl: v.optional(v.string()),
    attempts: v.number(),
    emailSentAt: v.optional(v.number()),
    createdAt: v.number(),
    resolvedAt: v.optional(v.number()),
  })
    .index("by_documentId", ["documentId"])
    .index("by_projectId", ["projectId"]),
});
