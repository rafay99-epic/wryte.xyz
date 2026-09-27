import type { WorkflowId } from "@convex-dev/workflow";
import { v } from "convex/values";
import { internal } from "../_generated/api";
import type { Doc, Id, TableNames } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import {
  action,
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "../_generated/server";
import { getAuthedUserOrNull, getCurrentUser } from "../_lib/auth";
import { validateAttributionText } from "../_lib/commitAttribution";
import { compressionSettingsValidator } from "../_lib/compression";
import { contentFormatValidator } from "../_lib/contentFormat";
import { getRateLimitKey, rateLimiter } from "../_lib/rateLimits";
import { type AiProvider, providerValidator } from "../ai/_lib/providers";
import { publishWorkflowManager } from "../integrations/scheduling";
import {
  type MediaProvider,
  mediaProviderValidator,
} from "../media/_lib/providers";

const MAX_PROJECTS_PER_USER = 100;

const projectFields = {
  _id: v.id("projects"),
  _creationTime: v.number(),
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
  contentFormat: v.optional(contentFormatValidator),
  defaultDraft: v.optional(v.boolean()),
  siteUrl: v.optional(v.string()),
  postUrlPrefix: v.optional(v.string()),
  deployHookUrl: v.optional(v.string()),
  frontmatterFormat: v.optional(v.union(v.literal("yaml"), v.literal("toml"))),
  framework: v.optional(v.string()),
  defaultAuthor: v.optional(v.string()),
  defaultAuthorAvatar: v.optional(v.string()),
  boardColumns: v.optional(v.string()),
  aiProvider: v.optional(providerValidator),
  aiModel: v.optional(v.string()),
  aiPromptTemplates: v.optional(v.string()),
  socialPostOnPublish: v.optional(v.boolean()),
  syndicateOnPublish: v.optional(v.boolean()),
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
  deployVerificationEnabled: v.optional(v.boolean()),
  compressionSettings: v.optional(compressionSettingsValidator),
  maxUploadBytes: v.optional(v.number()),
  trashRetentionDays: v.optional(v.number()),
  documentCount: v.optional(v.number()),
  createdAt: v.number(),
  updatedAt: v.number(),
};

const PROJECT_DOC = v.object(projectFields);

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

export async function projectsForUser(
  ctx: QueryCtx,
  userId: Id<"users">,
): Promise<Doc<"projects">[]> {
  const projects = await ctx.db
    .query("projects")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .take(100);

  return sortProjectsForList(projects);
}

async function projectsForCurrentUserOrEmpty(
  ctx: QueryCtx,
): Promise<Doc<"projects">[]> {
  const user = await getAuthedUserOrNull(ctx);
  if (!user) return [];
  return await projectsForUser(ctx, user._id);
}

async function projectForUser(
  ctx: QueryCtx,
  userId: Id<"users">,
  projectId: Id<"projects">,
): Promise<Doc<"projects"> | null> {
  const project = await ctx.db.get(projectId);
  if (!project) return null;
  if (project.userId !== userId) {
    throw new Error("Unauthorized: you do not own this project");
  }
  return project;
}

export const list = query({
  args: {},
  returns: v.array(PROJECT_DOC),
  handler: async (ctx) => {
    return await projectsForCurrentUserOrEmpty(ctx);
  },
});

export const listWithDocumentCounts = query({
  args: {},
  returns: v.array(
    v.object({
      ...projectFields,
      documentCount: v.number(),
    }),
  ),
  handler: async (ctx) => {
    const sorted = await projectsForCurrentUserOrEmpty(ctx);
    return sorted.map((p) => ({
      ...p,
      documentCount: p.documentCount ?? 0,
    }));
  },
});

export const get = query({
  args: { projectId: v.id("projects") },
  returns: v.union(v.null(), PROJECT_DOC),
  handler: async (ctx, args) => {
    const user = await getAuthedUserOrNull(ctx);
    if (!user) {
      throw new Error("Not authenticated");
    }
    return await projectForUser(ctx, user._id, args.projectId);
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    slug: v.string(),
    githubRepo: v.optional(v.string()),
    githubBranch: v.optional(v.string()),
    contentPath: v.optional(v.string()),
    mediaPath: v.optional(v.string()),
    animationsPath: v.optional(v.string()),
    animationsEnabled: v.optional(v.boolean()),
    importEnabled: v.optional(v.boolean()),
    mediaStorageMode: v.optional(mediaProviderValidator),
    frontmatterSchema: v.optional(v.string()),
    commitMessageTemplate: v.optional(v.string()),
    filenamePattern: v.optional(v.string()),
    contentFormat: v.optional(contentFormatValidator),
    defaultDraft: v.optional(v.boolean()),
    siteUrl: v.optional(v.string()),
    deployHookUrl: v.optional(v.string()),
    frontmatterFormat: v.optional(
      v.union(v.literal("yaml"), v.literal("toml")),
    ),
    framework: v.optional(v.string()),
    defaultAuthor: v.optional(v.string()),
    defaultAuthorAvatar: v.optional(v.string()),
    aiProvider: v.optional(providerValidator),
    aiModel: v.optional(v.string()),
  },
  returns: v.id("projects"),
  handler: async (ctx, args) => {
    const key = await getRateLimitKey(ctx);
    await rateLimiter.limit(ctx, "projects:create", { key, throws: true });

    const user = await getCurrentUser(ctx);
    const now = Date.now();

    const existing = await ctx.db
      .query("projects")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .take(MAX_PROJECTS_PER_USER + 1);
    if (existing.length >= MAX_PROJECTS_PER_USER) {
      throw new Error(
        `You've reached the limit of ${String(MAX_PROJECTS_PER_USER)} projects. Delete one before creating another.`,
      );
    }
    const anyOrdered = existing.some((p) => p.sortOrder !== undefined);

    const insertData: {
      userId: typeof user._id;
      name: string;
      slug: string;
      githubRepo?: string;
      githubBranch?: string;
      contentPath?: string;
      mediaPath?: string;
      animationsPath?: string;
      animationsEnabled?: boolean;
      importEnabled?: boolean;
      mediaStorageMode?: MediaProvider;
      frontmatterSchema?: string;
      commitMessageTemplate?: string;
      filenamePattern?: string;
      contentFormat?: "md" | "mdx";
      defaultDraft?: boolean;
      siteUrl?: string;
      deployHookUrl?: string;
      frontmatterFormat?: "yaml" | "toml";
      framework?: string;
      defaultAuthor?: string;
      defaultAuthorAvatar?: string;
      aiProvider?: AiProvider;
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
    if (args.animationsPath !== undefined)
      insertData.animationsPath = args.animationsPath;
    if (args.animationsEnabled !== undefined)
      insertData.animationsEnabled = args.animationsEnabled;
    if (args.mediaStorageMode !== undefined)
      insertData.mediaStorageMode = args.mediaStorageMode;
    if (args.frontmatterSchema !== undefined)
      insertData.frontmatterSchema = args.frontmatterSchema;
    if (args.commitMessageTemplate !== undefined)
      insertData.commitMessageTemplate = args.commitMessageTemplate;
    if (args.filenamePattern !== undefined)
      insertData.filenamePattern = args.filenamePattern;
    if (args.contentFormat !== undefined)
      insertData.contentFormat = args.contentFormat;
    if (args.defaultDraft !== undefined)
      insertData.defaultDraft = args.defaultDraft;
    if (args.siteUrl !== undefined) insertData.siteUrl = args.siteUrl;
    if (args.deployHookUrl !== undefined)
      insertData.deployHookUrl = args.deployHookUrl;
    if (args.frontmatterFormat !== undefined)
      insertData.frontmatterFormat = args.frontmatterFormat;
    if (args.framework !== undefined) insertData.framework = args.framework;
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

export const update = mutation({
  args: {
    projectId: v.id("projects"),
    name: v.optional(v.string()),
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
    contentFormat: v.optional(contentFormatValidator),
    defaultDraft: v.optional(v.boolean()),
    siteUrl: v.optional(v.string()),
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
    timezone: v.optional(v.string()),
    autoSaveEnabled: v.optional(v.boolean()),
    isFavorite: v.optional(v.boolean()),
    sortOrder: v.optional(v.number()),
    compressionSettings: v.optional(
      v.union(compressionSettingsValidator, v.null()),
    ),
    maxUploadBytes: v.optional(v.union(v.number(), v.null())),
    trashRetentionDays: v.optional(v.number()),
    socialPostOnPublish: v.optional(v.boolean()),
    syndicateOnPublish: v.optional(v.boolean()),
    deployVerificationEnabled: v.optional(v.boolean()),
    postUrlPrefix: v.optional(v.string()),
    readabilityLensEnabled: v.optional(v.boolean()),
    autoWatermarkRemoval: v.optional(v.boolean()),
    slashCommandsEnabled: v.optional(v.boolean()),
    snippetsEnabled: v.optional(v.boolean()),
    selectionToolbarEnabled: v.optional(v.boolean()),
  },
  returns: v.null(),
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

    if (args.commitAttributionText !== undefined) {
      const error = validateAttributionText(args.commitAttributionText.trim());
      if (error) {
        throw new Error(error);
      }
    }

    const { projectId, ...updates } = args;
    const fieldsToUpdate: Record<string, unknown> = { updatedAt: Date.now() };

    for (const [k, value] of Object.entries(updates)) {
      if (value === undefined) continue;
      if (k === "compressionSettings" && value === null) {
        fieldsToUpdate["compressionSettings"] = undefined;
        continue;
      }
      if (k === "maxUploadBytes" && value === null) {
        fieldsToUpdate["maxUploadBytes"] = undefined;
        continue;
      }
      if (k === "commitAttributionText" && typeof value === "string") {
        fieldsToUpdate[k] = value.trim() || undefined;
        continue;
      }
      if (k === "animationsPath" && typeof value === "string") {
        fieldsToUpdate[k] = value.trim() || undefined;
        continue;
      }
      fieldsToUpdate[k] = value;
    }

    await ctx.db.patch(projectId, fieldsToUpdate);
    return null;
  },
});

export const remove = action({
  args: { projectId: v.id("projects") },
  returns: v.object({
    ok: v.literal(true),
    summary: v.object({
      documentsDeleted: v.number(),
      mediaDeleted: v.number(),
      scheduledCancelled: v.number(),
      scheduledFailedToCancel: v.number(),
      vaultDeleted: v.number(),
      vaultOrphaned: v.number(),
    }),
  }),
  handler: async (
    ctx,
    args,
  ): Promise<{
    ok: true;
    summary: {
      documentsDeleted: number;
      mediaDeleted: number;
      scheduledCancelled: number;
      scheduledFailedToCancel: number;
      vaultDeleted: number;
      vaultOrphaned: number;
    };
  }> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const key = await getRateLimitKey(ctx);
    await rateLimiter.limit(ctx, "projects:remove", { key, throws: true });

    const user = await ctx.runQuery(internal.account.users.internalGetByToken, {
      tokenIdentifier: identity.tokenIdentifier,
    });
    if (!user) throw new Error("User not found");

    const project = await ctx.runQuery(internal.cms.projects.internalGet, {
      projectId: args.projectId,
    });
    if (!project) throw new Error("Project not found");
    if (project.userId !== user._id) {
      throw new Error("Unauthorized: you do not own this project");
    }

    const cancellationTargets = await ctx.runQuery(
      internal.cms.projects._listProjectCancellationTargets,
      { projectId: args.projectId },
    );
    let scheduledCancelled = 0;
    let scheduledFailedToCancel = 0;
    for (const target of cancellationTargets) {
      if (!target.workflowId) continue;
      try {
        await publishWorkflowManager.cancel(
          ctx,
          target.workflowId as WorkflowId,
        );
        scheduledCancelled++;
      } catch {
        scheduledFailedToCancel++;
      }
    }

    const vaultIds = await ctx.runQuery(
      internal.cms.projects._listProjectVaultIds,
      { projectId: args.projectId },
    );
    let vaultDeleted = 0;
    let vaultOrphaned = 0;
    for (const id of vaultIds) {
      try {
        await ctx.runAction(internal.integrations.secretStore._delete, { id });
        vaultDeleted++;
      } catch {
        vaultOrphaned++;
      }
    }

    let documentsDeleted = 0;
    let mediaDeleted = 0;
    for (let i = 0; i < 200; i++) {
      const chunk = await ctx.runMutation(
        internal.cms.projects._wipeProjectChunk,
        { projectId: args.projectId, batch: 200 },
      );
      documentsDeleted += chunk.documentsDeleted;
      mediaDeleted += chunk.mediaDeleted;
      if (chunk.remaining === 0) break;
    }

    const finalize = await ctx.runMutation(
      internal.cms.projects._deleteProjectRow,
      { projectId: args.projectId },
    );
    if (!finalize.deleted && finalize.remaining > 0) {
      throw new Error(
        `Project has more dependent rows than this delete pass can handle (${String(finalize.remaining)} remaining). Try again to continue the cleanup.`,
      );
    }

    return {
      ok: true,
      summary: {
        documentsDeleted,
        mediaDeleted,
        scheduledCancelled,
        scheduledFailedToCancel,
        vaultDeleted,
        vaultOrphaned,
      },
    };
  },
});

export const _listProjectCancellationTargets = internalQuery({
  args: { projectId: v.id("projects") },
  returns: v.array(
    v.object({
      _id: v.id("scheduled_publishes"),
      workflowId: v.optional(v.string()),
      status: v.union(
        v.literal("pending"),
        v.literal("processing"),
        v.literal("completed"),
        v.literal("failed"),
      ),
    }),
  ),
  handler: async (
    ctx,
    args,
  ): Promise<
    Array<{
      _id: Id<"scheduled_publishes">;
      workflowId?: string;
      status: "pending" | "processing" | "completed" | "failed";
    }>
  > => {
    const documents = await ctx.db
      .query("documents")
      .withIndex("by_projectId", (q) => q.eq("projectId", args.projectId))
      .take(5000);

    const out: Array<{
      _id: Id<"scheduled_publishes">;
      workflowId?: string;
      status: "pending" | "processing" | "completed" | "failed";
    }> = [];

    for (const doc of documents) {
      const rows = await ctx.db
        .query("scheduled_publishes")
        .withIndex("by_documentId", (q) => q.eq("documentId", doc._id))
        .take(20);
      for (const row of rows) {
        if (row.status === "pending" || row.status === "processing") {
          const entry: {
            _id: Id<"scheduled_publishes">;
            workflowId?: string;
            status: "pending" | "processing" | "completed" | "failed";
          } = { _id: row._id, status: row.status };
          if (row.workflowId !== undefined) entry.workflowId = row.workflowId;
          out.push(entry);
        }
      }
    }
    return out;
  },
});

export const _listProjectVaultIds = internalQuery({
  args: { projectId: v.id("projects") },
  returns: v.array(v.string()),
  handler: async (ctx, args): Promise<string[]> =>
    await listProjectVaultIds(ctx, args.projectId),
});

export async function listProjectVaultIds(
  ctx: QueryCtx,
  projectId: Id<"projects">,
): Promise<string[]> {
  const groups = await Promise.all([
    ctx.db
      .query("mediaCredentials")
      .withIndex("by_projectId", (q) => q.eq("projectId", projectId))
      .take(50),
    ctx.db
      .query("aiCredentials")
      .withIndex("by_projectId", (q) => q.eq("projectId", projectId))
      .take(50),
    ctx.db
      .query("socialCredentials")
      .withIndex("by_projectId", (q) => q.eq("projectId", projectId))
      .take(50),
    ctx.db
      .query("syndicationCredentials")
      .withIndex("by_projectId", (q) => q.eq("projectId", projectId))
      .take(50),
    ctx.db
      .query("deployment_targets")
      .withIndex("by_projectId", (q) => q.eq("projectId", projectId))
      .take(50),
    ctx.db
      .query("analytics_targets")
      .withIndex("by_projectId", (q) => q.eq("projectId", projectId))
      .take(50),
  ]);
  const ids: string[] = [];
  for (const rows of groups) {
    for (const row of rows) {
      if (row.vaultSecretId) ids.push(row.vaultSecretId);
    }
  }
  return ids;
}

export const _wipeProjectChunk = internalMutation({
  args: {
    projectId: v.id("projects"),
    batch: v.number(),
  },
  returns: v.object({
    remaining: v.number(),
    documentsDeleted: v.number(),
    mediaDeleted: v.number(),
  }),
  handler: async (
    ctx,
    args,
  ): Promise<{
    remaining: number;
    documentsDeleted: number;
    mediaDeleted: number;
  }> => {
    const { documentsDeleted, mediaDeleted } = await wipeProjectRows(
      ctx,
      args.projectId,
      args.batch,
    );
    const remaining = await countProjectRemaining(ctx, args.projectId);
    return { remaining, documentsDeleted, mediaDeleted };
  },
});

async function deleteRows(
  ctx: MutationCtx,
  rows: ReadonlyArray<{ _id: Id<TableNames> }>,
): Promise<number> {
  for (const row of rows) await ctx.db.delete(row._id);
  return rows.length;
}

function looseProjectTables(
  db: MutationCtx["db"],
  projectId: Id<"projects">,
): Array<(n: number) => Promise<Array<{ _id: Id<TableNames> }>>> {
  return [
    (n) =>
      db
        .query("social_posts")
        .withIndex("by_projectId", (q) => q.eq("projectId", projectId))
        .take(n),
    (n) =>
      db
        .query("syndication_posts")
        .withIndex("by_projectId", (q) => q.eq("projectId", projectId))
        .take(n),
    (n) =>
      db
        .query("deploy_verifications")
        .withIndex("by_projectId", (q) => q.eq("projectId", projectId))
        .take(n),
    (n) =>
      db
        .query("deployment_targets")
        .withIndex("by_projectId", (q) => q.eq("projectId", projectId))
        .take(n),
    (n) =>
      db
        .query("syndicationCredentials")
        .withIndex("by_projectId", (q) => q.eq("projectId", projectId))
        .take(n),
    (n) =>
      db
        .query("snippets")
        .withIndex("by_project", (q) => q.eq("projectId", projectId))
        .take(n),
    (n) =>
      db
        .query("animation_names")
        .withIndex("by_project", (q) => q.eq("projectId", projectId))
        .take(n),
    (n) =>
      db
        .query("analytics_targets")
        .withIndex("by_projectId", (q) => q.eq("projectId", projectId))
        .take(n),
    (n) =>
      db
        .query("analytics_snapshots")
        .withIndex("by_projectId", (q) => q.eq("projectId", projectId))
        .take(n),
  ];
}

export async function wipeProjectRows(
  ctx: MutationCtx,
  projectId: Id<"projects">,
  initialBudget: number,
): Promise<{ budget: number; documentsDeleted: number; mediaDeleted: number }> {
  let budget = initialBudget;
  let documentsDeleted = 0;
  let mediaDeleted = 0;

  if (budget > 0) {
    const documents = await ctx.db
      .query("documents")
      .withIndex("by_projectId", (q) => q.eq("projectId", projectId))
      .take(Math.min(budget + 1, 5000));
    for (const doc of documents) {
      if (budget <= 0) break;
      const rows = await ctx.db
        .query("scheduled_publishes")
        .withIndex("by_documentId", (q) => q.eq("documentId", doc._id))
        .take(budget);
      for (const row of rows) {
        await ctx.db.delete(row._id);
        budget--;
      }
    }
  }

  if (budget > 0) {
    const rows = await ctx.db
      .query("publish_history_content")
      .withIndex("by_projectId", (q) => q.eq("projectId", projectId))
      .take(budget);
    for (const row of rows) {
      await ctx.db.delete(row._id);
      budget--;
    }
  }

  if (budget > 0) {
    const rows = await ctx.db
      .query("publish_history")
      .withIndex("by_projectId", (q) => q.eq("projectId", projectId))
      .take(budget);
    for (const row of rows) {
      await ctx.db.delete(row._id);
      budget--;
    }
  }

  if (budget > 0) {
    const rows = await ctx.db
      .query("document_draft_content")
      .withIndex("by_projectId", (q) => q.eq("projectId", projectId))
      .take(budget);
    for (const row of rows) {
      await ctx.db.delete(row._id);
      budget--;
    }
  }

  if (budget > 0) {
    const rows = await ctx.db
      .query("document_drafts")
      .withIndex("by_projectId", (q) => q.eq("projectId", projectId))
      .take(budget);
    for (const row of rows) {
      await ctx.db.delete(row._id);
      budget--;
    }
  }

  if (budget > 0) {
    const rows = await ctx.db
      .query("document_research")
      .withIndex("by_projectId", (q) => q.eq("projectId", projectId))
      .take(budget);
    for (const row of rows) {
      await ctx.db.delete(row._id);
      budget--;
    }
  }

  if (budget > 0) {
    const rows = await ctx.db
      .query("document_snapshot_content")
      .withIndex("by_projectId", (q) => q.eq("projectId", projectId))
      .take(budget);
    for (const row of rows) {
      await ctx.db.delete(row._id);
      budget--;
    }
  }

  if (budget > 0) {
    const rows = await ctx.db
      .query("document_snapshots")
      .withIndex("by_projectId", (q) => q.eq("projectId", projectId))
      .take(budget);
    for (const row of rows) {
      await ctx.db.delete(row._id);
      budget--;
    }
  }

  if (budget > 0) {
    const rows = await ctx.db
      .query("ideas")
      .withIndex("by_projectId", (q) => q.eq("projectId", projectId))
      .take(budget);
    for (const row of rows) {
      await ctx.db.delete(row._id);
      budget--;
    }
  }

  if (budget > 0) {
    const rows = await ctx.db
      .query("share_links")
      .withIndex("by_projectId", (q) => q.eq("projectId", projectId))
      .take(budget);
    for (const row of rows) {
      await ctx.db.delete(row._id);
      budget--;
    }
  }

  if (budget > 0) {
    const rows = await ctx.db
      .query("media")
      .withIndex("by_projectId", (q) => q.eq("projectId", projectId))
      .take(budget);
    for (const row of rows) {
      await ctx.db.delete(row._id);
      budget--;
      mediaDeleted++;
    }
  }

  if (budget > 0) {
    const rows = await ctx.db
      .query("mediaErrorLog")
      .withIndex("by_projectId_and_createdAt", (q) =>
        q.eq("projectId", projectId),
      )
      .take(budget);
    for (const row of rows) {
      await ctx.db.delete(row._id);
      budget--;
    }
  }

  if (budget > 0) {
    const rows = await ctx.db
      .query("mediaUsage")
      .withIndex("by_projectId", (q) => q.eq("projectId", projectId))
      .take(budget);
    for (const row of rows) {
      await ctx.db.delete(row._id);
      budget--;
    }
  }

  if (budget > 0) {
    const rows = await ctx.db
      .query("mediaCredentials")
      .withIndex("by_projectId", (q) => q.eq("projectId", projectId))
      .take(budget);
    for (const row of rows) {
      await ctx.db.delete(row._id);
      budget--;
    }
  }
  if (budget > 0) {
    const rows = await ctx.db
      .query("aiCredentials")
      .withIndex("by_projectId", (q) => q.eq("projectId", projectId))
      .take(budget);
    for (const row of rows) {
      await ctx.db.delete(row._id);
      budget--;
    }
  }
  if (budget > 0) {
    const rows = await ctx.db
      .query("socialCredentials")
      .withIndex("by_projectId", (q) => q.eq("projectId", projectId))
      .take(budget);
    for (const row of rows) {
      await ctx.db.delete(row._id);
      budget--;
    }
  }

  if (budget > 0) {
    const rows = await ctx.db
      .query("sync_conflicts")
      .withIndex("by_projectId", (q) => q.eq("projectId", projectId))
      .take(budget);
    for (const row of rows) {
      await ctx.db.delete(row._id);
      budget--;
    }
  }

  if (budget > 0) {
    const batches = await ctx.db
      .query("import_batches")
      .withIndex("by_projectId_and_createdAt", (q) =>
        q.eq("projectId", projectId),
      )
      .take(budget);
    for (const batch of batches) {
      if (budget <= 0) break;
      const outcomes = await ctx.db
        .query("import_job_outcomes")
        .withIndex("by_batchId", (q) => q.eq("batchId", batch._id))
        .take(budget);
      for (const outcome of outcomes) {
        await ctx.db.delete(outcome._id);
        budget--;
      }
      if (budget > 0) {
        const remaining = await ctx.db
          .query("import_job_outcomes")
          .withIndex("by_batchId", (q) => q.eq("batchId", batch._id))
          .take(1);
        if (remaining.length === 0) {
          await ctx.db.delete(batch._id);
          budget--;
        }
      }
    }
  }

  if (budget > 0) {
    const batches = await ctx.db
      .query("delete_batches")
      .withIndex("by_projectId_and_createdAt", (q) =>
        q.eq("projectId", projectId),
      )
      .take(budget);
    for (const batch of batches) {
      if (budget <= 0) break;
      const outcomes = await ctx.db
        .query("delete_job_outcomes")
        .withIndex("by_batchId", (q) => q.eq("batchId", batch._id))
        .take(budget);
      for (const outcome of outcomes) {
        await ctx.db.delete(outcome._id);
        budget--;
      }
      if (budget > 0) {
        const remaining = await ctx.db
          .query("delete_job_outcomes")
          .withIndex("by_batchId", (q) => q.eq("batchId", batch._id))
          .take(1);
        if (remaining.length === 0) {
          await ctx.db.delete(batch._id);
          budget--;
        }
      }
    }
  }

  if (budget > 0) {
    const rows = await ctx.db
      .query("ai_stream_owners")
      .withIndex("by_projectId", (q) => q.eq("projectId", projectId))
      .take(budget);
    for (const row of rows) {
      await ctx.db.delete(row._id);
      budget--;
    }
  }

  if (budget > 0) {
    const rows = await ctx.db
      .query("document_links")
      .withIndex("by_projectId", (q) => q.eq("projectId", projectId))
      .take(budget);
    for (const row of rows) {
      await ctx.db.delete(row._id);
      budget--;
    }
  }

  if (budget > 0) {
    const rows = await ctx.db
      .query("animations")
      .withIndex("by_project", (q) => q.eq("projectId", projectId))
      .take(budget);
    for (const row of rows) {
      await ctx.db.delete(row._id);
      budget--;
    }
  }

  for (const read of looseProjectTables(ctx.db, projectId)) {
    if (budget <= 0) break;
    budget -= await deleteRows(ctx, await read(budget));
  }

  if (budget > 0) {
    const rows = await ctx.db
      .query("project_stats")
      .withIndex("by_projectId", (q) => q.eq("projectId", projectId))
      .take(budget);
    for (const row of rows) {
      if (row.totalWords > 0) {
        const userStats = await ctx.db
          .query("writing_stats")
          .withIndex("by_userId", (q) => q.eq("userId", row.userId))
          .unique();
        if (userStats) {
          await ctx.db.patch(userStats._id, {
            totalWords: Math.max(0, userStats.totalWords - row.totalWords),
            updatedAt: Date.now(),
          });
        }
      }
      await ctx.db.delete(row._id);
      budget--;
    }
  }

  if (budget > 0) {
    const rows = await ctx.db
      .query("document_content")
      .withIndex("by_projectId", (q) => q.eq("projectId", projectId))
      .take(budget);
    for (const row of rows) {
      await ctx.db.delete(row._id);
      budget--;
    }
  }

  if (budget > 0) {
    const rows = await ctx.db
      .query("documents")
      .withIndex("by_projectId", (q) => q.eq("projectId", projectId))
      .take(budget);
    for (const row of rows) {
      await ctx.db.delete(row._id);
      budget--;
      documentsDeleted++;
    }
  }

  return { budget, documentsDeleted, mediaDeleted };
}

export const _deleteProjectRow = internalMutation({
  args: { projectId: v.id("projects") },
  returns: v.object({
    deleted: v.boolean(),
    remaining: v.number(),
  }),
  handler: async (
    ctx,
    args,
  ): Promise<{ deleted: boolean; remaining: number }> => {
    const project = await ctx.db.get(args.projectId);
    if (!project) return { deleted: false, remaining: 0 };

    const remaining = await countProjectRemaining(ctx, args.projectId);
    if (remaining > 0) return { deleted: false, remaining };

    await ctx.db.delete(args.projectId);
    return { deleted: true, remaining: 0 };
  },
});

export async function countProjectRemaining(
  ctx: { db: MutationCtx["db"] },
  projectId: Id<"projects">,
): Promise<number> {
  const heads = await Promise.all([
    ctx.db
      .query("documents")
      .withIndex("by_projectId", (q) => q.eq("projectId", projectId))
      .take(1),
    ctx.db
      .query("document_content")
      .withIndex("by_projectId", (q) => q.eq("projectId", projectId))
      .take(1),
    ctx.db
      .query("media")
      .withIndex("by_projectId", (q) => q.eq("projectId", projectId))
      .take(1),
    ctx.db
      .query("publish_history_content")
      .withIndex("by_projectId", (q) => q.eq("projectId", projectId))
      .take(1),
    ctx.db
      .query("publish_history")
      .withIndex("by_projectId", (q) => q.eq("projectId", projectId))
      .take(1),
    ctx.db
      .query("document_draft_content")
      .withIndex("by_projectId", (q) => q.eq("projectId", projectId))
      .take(1),
    ctx.db
      .query("document_drafts")
      .withIndex("by_projectId", (q) => q.eq("projectId", projectId))
      .take(1),
    ctx.db
      .query("document_research")
      .withIndex("by_projectId", (q) => q.eq("projectId", projectId))
      .take(1),
    ctx.db
      .query("document_snapshot_content")
      .withIndex("by_projectId", (q) => q.eq("projectId", projectId))
      .take(1),
    ctx.db
      .query("document_snapshots")
      .withIndex("by_projectId", (q) => q.eq("projectId", projectId))
      .take(1),
    ctx.db
      .query("ideas")
      .withIndex("by_projectId", (q) => q.eq("projectId", projectId))
      .take(1),
    ctx.db
      .query("share_links")
      .withIndex("by_projectId", (q) => q.eq("projectId", projectId))
      .take(1),
    ctx.db
      .query("mediaUsage")
      .withIndex("by_projectId", (q) => q.eq("projectId", projectId))
      .take(1),
    ctx.db
      .query("mediaErrorLog")
      .withIndex("by_projectId_and_createdAt", (q) =>
        q.eq("projectId", projectId),
      )
      .take(1),
    ctx.db
      .query("mediaCredentials")
      .withIndex("by_projectId", (q) => q.eq("projectId", projectId))
      .take(1),
    ctx.db
      .query("aiCredentials")
      .withIndex("by_projectId", (q) => q.eq("projectId", projectId))
      .take(1),
    ctx.db
      .query("socialCredentials")
      .withIndex("by_projectId", (q) => q.eq("projectId", projectId))
      .take(1),
    ctx.db
      .query("sync_conflicts")
      .withIndex("by_projectId", (q) => q.eq("projectId", projectId))
      .take(1),
    ctx.db
      .query("import_batches")
      .withIndex("by_projectId_and_createdAt", (q) =>
        q.eq("projectId", projectId),
      )
      .take(1),
    ctx.db
      .query("delete_batches")
      .withIndex("by_projectId_and_createdAt", (q) =>
        q.eq("projectId", projectId),
      )
      .take(1),
    ctx.db
      .query("ai_stream_owners")
      .withIndex("by_projectId", (q) => q.eq("projectId", projectId))
      .take(1),
    ctx.db
      .query("project_stats")
      .withIndex("by_projectId", (q) => q.eq("projectId", projectId))
      .take(1),
    ctx.db
      .query("document_links")
      .withIndex("by_projectId", (q) => q.eq("projectId", projectId))
      .take(1),
    ctx.db
      .query("animations")
      .withIndex("by_project", (q) => q.eq("projectId", projectId))
      .take(1),
    ...looseProjectTables(ctx.db, projectId).map((read) => read(1)),
  ]);
  let count = 0;
  for (const r of heads) count += r.length;
  return count;
}

export const internalGet = internalQuery({
  args: { projectId: v.id("projects") },
  returns: v.union(v.null(), PROJECT_DOC),
  handler: async (ctx, args) => {
    return await ctx.db.get(args.projectId);
  },
});

export const _backfillDocumentCounts = internalMutation({
  args: {},
  returns: v.object({
    total: v.number(),
    updated: v.number(),
  }),
  handler: async (ctx) => {
    const projects = await ctx.db.query("projects").take(1000);
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
