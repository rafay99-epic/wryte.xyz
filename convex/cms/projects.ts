import type { WorkflowId } from "@convex-dev/workflow";
import { v } from "convex/values";
import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import {
  action,
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "../_generated/server";
import { getAuthedUserOrNull, getCurrentUser } from "../_lib/auth";
import { compressionSettingsValidator } from "../_lib/compression";
import { contentFormatValidator } from "../_lib/contentFormat";
import { getRateLimitKey, rateLimiter } from "../_lib/rateLimits";
import { type AiProvider, providerValidator } from "../ai/_lib/providers";
import { publishWorkflowManager } from "../integrations/scheduling";

/** Hard cap on projects per user. The dashboard's project list query also
 *  uses `.take(100)`, so anything above this gets silently truncated in the
 *  UI — the limit enforces the cap explicitly at create-time. */
const MAX_PROJECTS_PER_USER = 100;

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
    .take(100);

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
      ),
    ),
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
      mediaStorageMode?: "github" | "uploadthing" | "cloudinary";
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
      ),
    ),
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
    boardColumns: v.optional(v.string()),
    aiProvider: v.optional(providerValidator),
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
     * Per-project maximum upload size in bytes. Pass a number to set the
     * override, or `null` to clear it and fall back to the default.
     */
    maxUploadBytes: v.optional(v.union(v.number(), v.null())),
    /**
     * How many days soft-deleted docs sit in trash before the daily
     * cleanup cron hard-deletes them. Setting to a very large number
     * (e.g. 36500 for "100 years") is the UX for "Never auto-cleanup".
     */
    trashRetentionDays: v.optional(v.number()),
    socialPostOnPublish: v.optional(v.boolean()),
    /** Path segment between site URL and post slug ("" = site root). */
    postUrlPrefix: v.optional(v.string()),
    readabilityLensEnabled: v.optional(v.boolean()),
    autoWatermarkRemoval: v.optional(v.boolean()),
    slashCommandsEnabled: v.optional(v.boolean()),
    snippetsEnabled: v.optional(v.boolean()),
    selectionToolbarEnabled: v.optional(v.boolean()),
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
      if (k === "maxUploadBytes" && value === null) {
        fieldsToUpdate["maxUploadBytes"] = undefined;
        continue;
      }
      fieldsToUpdate[k] = value;
    }

    await ctx.db.patch(projectId, fieldsToUpdate);
  },
});

/**
 * Deletes a project and every row that hangs off it: documents and their
 * scheduled publishes, drafts, research, publish history, sync conflicts,
 * import/delete batches, and the three flavors of per-project credential
 * along with their WorkOS Vault entries.
 *
 * Implemented as an action so we can cancel publish workflows and reach
 * into the vault. The Convex wipe is chunked through an internal mutation
 * so projects with thousands of rows don't blow the per-transaction limit.
 *
 * @requires Authentication + project ownership
 */
export const remove = action({
  args: { projectId: v.id("projects") },
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

    /* -- Step A: cancel pending publish workflows for this project -- */
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

    /* -- Step B: drop vault entries for credentials owned by this project -- */
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

    /* -- Step C: chunked Convex wipe. The chunk caps at 200 deletes per
     *    transaction so a project with thousands of rows fans out across
     *    multiple mutations instead of blowing the per-transaction limit.
     *    The 200-iteration ceiling caps a single invocation at ~40k rows;
     *    larger projects need a retry from the UI. */
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

    /* -- Step D: drop the project row itself. _deleteProjectRow is
     *    idempotent — it returns { deleted, remaining } so we can surface
     *    a partial-success summary instead of throwing into the UI. */
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

/* ------------------------------------------------------------------ */
/*  Internal helpers used by the cascade action                          */
/* ------------------------------------------------------------------ */

export const _listProjectCancellationTargets = internalQuery({
  args: { projectId: v.id("projects") },
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
  handler: async (ctx, args): Promise<string[]> => {
    const ids: string[] = [];

    const mediaCreds = await ctx.db
      .query("mediaCredentials")
      .withIndex("by_projectId", (q) => q.eq("projectId", args.projectId))
      .take(20);
    for (const c of mediaCreds) {
      if (c.vaultSecretId) ids.push(c.vaultSecretId);
    }

    const aiCreds = await ctx.db
      .query("aiCredentials")
      .withIndex("by_projectId", (q) => q.eq("projectId", args.projectId))
      .take(20);
    for (const c of aiCreds) {
      if (c.vaultSecretId) ids.push(c.vaultSecretId);
    }

    const socialCreds = await ctx.db
      .query("socialCredentials")
      .withIndex("by_projectId", (q) => q.eq("projectId", args.projectId))
      .take(20);
    for (const c of socialCreds) {
      if (c.vaultSecretId) ids.push(c.vaultSecretId);
    }

    return ids;
  },
});

/**
 * Drains as many project-scoped rows as `batch` allows in a single
 * transaction, then returns `remaining` so the orchestrator can decide
 * whether to loop. Deletion order matches `selfDestruct._wipeChunk` so the
 * dependency tree unwinds cleanly (workflow rows first, project last).
 */
export const _wipeProjectChunk = internalMutation({
  args: {
    projectId: v.id("projects"),
    batch: v.number(),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{
    remaining: number;
    documentsDeleted: number;
    mediaDeleted: number;
  }> => {
    let budget = args.batch;
    let documentsDeleted = 0;
    let mediaDeleted = 0;

    /* 1. scheduled_publishes via documents. Walks docs and decrements the
     *    shared budget per scheduled_publish deleted so a project with many
     *    docs × many SPs doesn't blow the per-transaction read/write limit
     *    in a single chunk. Mirrors `selfDestruct._wipeChunk` step 1. */
    if (budget > 0) {
      const documents = await ctx.db
        .query("documents")
        .withIndex("by_projectId", (q) => q.eq("projectId", args.projectId))
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

    /* 1b. publish_history_content — drained before `publish_history` so a
     *     re-run never leaves an orphaned content row. */
    if (budget > 0) {
      const rows = await ctx.db
        .query("publish_history_content")
        .withIndex("by_projectId", (q) => q.eq("projectId", args.projectId))
        .take(budget);
      for (const row of rows) {
        await ctx.db.delete(row._id);
        budget--;
      }
    }

    /* 2. publish_history */
    if (budget > 0) {
      const rows = await ctx.db
        .query("publish_history")
        .withIndex("by_projectId", (q) => q.eq("projectId", args.projectId))
        .take(budget);
      for (const row of rows) {
        await ctx.db.delete(row._id);
        budget--;
      }
    }

    /* 2b. document_draft_content — drained before `document_drafts` so a
     *     re-run never leaves an orphaned content row pointing at a
     *     deleted draft. Mirrors the `document_content`/`documents`
     *     ordering used at the end of this chunk (step 13b/14). */
    if (budget > 0) {
      const rows = await ctx.db
        .query("document_draft_content")
        .withIndex("by_projectId", (q) => q.eq("projectId", args.projectId))
        .take(budget);
      for (const row of rows) {
        await ctx.db.delete(row._id);
        budget--;
      }
    }

    /* 3. document_drafts */
    if (budget > 0) {
      const rows = await ctx.db
        .query("document_drafts")
        .withIndex("by_projectId", (q) => q.eq("projectId", args.projectId))
        .take(budget);
      for (const row of rows) {
        await ctx.db.delete(row._id);
        budget--;
      }
    }

    /* 4. document_research */
    if (budget > 0) {
      const rows = await ctx.db
        .query("document_research")
        .withIndex("by_projectId", (q) => q.eq("projectId", args.projectId))
        .take(budget);
      for (const row of rows) {
        await ctx.db.delete(row._id);
        budget--;
      }
    }

    /* 4a2. document_snapshot_content — drained before `document_snapshots`
     *      so a re-run never leaves an orphaned content row. */
    if (budget > 0) {
      const rows = await ctx.db
        .query("document_snapshot_content")
        .withIndex("by_projectId", (q) => q.eq("projectId", args.projectId))
        .take(budget);
      for (const row of rows) {
        await ctx.db.delete(row._id);
        budget--;
      }
    }

    /* 4b. document_snapshots */
    if (budget > 0) {
      const rows = await ctx.db
        .query("document_snapshots")
        .withIndex("by_projectId", (q) => q.eq("projectId", args.projectId))
        .take(budget);
      for (const row of rows) {
        await ctx.db.delete(row._id);
        budget--;
      }
    }

    /* 4c. ideas */
    if (budget > 0) {
      const rows = await ctx.db
        .query("ideas")
        .withIndex("by_projectId", (q) => q.eq("projectId", args.projectId))
        .take(budget);
      for (const row of rows) {
        await ctx.db.delete(row._id);
        budget--;
      }
    }

    /* 4d. share_links */
    if (budget > 0) {
      const rows = await ctx.db
        .query("share_links")
        .withIndex("by_projectId", (q) => q.eq("projectId", args.projectId))
        .take(budget);
      for (const row of rows) {
        await ctx.db.delete(row._id);
        budget--;
      }
    }

    /* 5. media */
    if (budget > 0) {
      const rows = await ctx.db
        .query("media")
        .withIndex("by_projectId", (q) => q.eq("projectId", args.projectId))
        .take(budget);
      for (const row of rows) {
        await ctx.db.delete(row._id);
        budget--;
        mediaDeleted++;
      }
    }

    /* 6. mediaErrorLog */
    if (budget > 0) {
      const rows = await ctx.db
        .query("mediaErrorLog")
        .withIndex("by_projectId_and_createdAt", (q) =>
          q.eq("projectId", args.projectId),
        )
        .take(budget);
      for (const row of rows) {
        await ctx.db.delete(row._id);
        budget--;
      }
    }

    /* 7. mediaUsage */
    if (budget > 0) {
      const rows = await ctx.db
        .query("mediaUsage")
        .withIndex("by_projectId", (q) => q.eq("projectId", args.projectId))
        .take(budget);
      for (const row of rows) {
        await ctx.db.delete(row._id);
        budget--;
      }
    }

    /* 8. credentials (vault entries already dropped in step B) */
    if (budget > 0) {
      const rows = await ctx.db
        .query("mediaCredentials")
        .withIndex("by_projectId", (q) => q.eq("projectId", args.projectId))
        .take(budget);
      for (const row of rows) {
        await ctx.db.delete(row._id);
        budget--;
      }
    }
    if (budget > 0) {
      const rows = await ctx.db
        .query("aiCredentials")
        .withIndex("by_projectId", (q) => q.eq("projectId", args.projectId))
        .take(budget);
      for (const row of rows) {
        await ctx.db.delete(row._id);
        budget--;
      }
    }
    if (budget > 0) {
      const rows = await ctx.db
        .query("socialCredentials")
        .withIndex("by_projectId", (q) => q.eq("projectId", args.projectId))
        .take(budget);
      for (const row of rows) {
        await ctx.db.delete(row._id);
        budget--;
      }
    }

    /* 9. sync_conflicts */
    if (budget > 0) {
      const rows = await ctx.db
        .query("sync_conflicts")
        .withIndex("by_projectId", (q) => q.eq("projectId", args.projectId))
        .take(budget);
      for (const row of rows) {
        await ctx.db.delete(row._id);
        budget--;
      }
    }

    /* 10. import_batches + outcomes */
    if (budget > 0) {
      const batches = await ctx.db
        .query("import_batches")
        .withIndex("by_projectId_and_createdAt", (q) =>
          q.eq("projectId", args.projectId),
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

    /* 11. delete_batches + outcomes */
    if (budget > 0) {
      const batches = await ctx.db
        .query("delete_batches")
        .withIndex("by_projectId_and_createdAt", (q) =>
          q.eq("projectId", args.projectId),
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

    /* 12. ai_stream_owners — bookkeeping for AI stream ownership. Rows
     *     here outlive the underlying stream blob (which the persistent-
     *     text-streaming component cleans up on its own schedule), but
     *     without this branch they accumulate forever when a project is
     *     deleted. */
    if (budget > 0) {
      const rows = await ctx.db
        .query("ai_stream_owners")
        .withIndex("by_projectId", (q) => q.eq("projectId", args.projectId))
        .take(budget);
      for (const row of rows) {
        await ctx.db.delete(row._id);
        budget--;
      }
    }

    /* 12b. document_links — the backlink graph for this project's documents.
     *      Direct `by_projectId` index, so no need to walk the documents. */
    if (budget > 0) {
      const rows = await ctx.db
        .query("document_links")
        .withIndex("by_projectId", (q) => q.eq("projectId", args.projectId))
        .take(budget);
      for (const row of rows) {
        await ctx.db.delete(row._id);
        budget--;
      }
    }

    /* 13. project_stats — subtract from writing_stats.totalWords before
     *     deleting so the user's lifetime total stays accurate. */
    if (budget > 0) {
      const rows = await ctx.db
        .query("project_stats")
        .withIndex("by_projectId", (q) => q.eq("projectId", args.projectId))
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

    /* 13b. document_content — drain bodies before the parent documents so
     *      a re-run never leaves orphaned content rows. */
    if (budget > 0) {
      const rows = await ctx.db
        .query("document_content")
        .withIndex("by_projectId", (q) => q.eq("projectId", args.projectId))
        .take(budget);
      for (const row of rows) {
        await ctx.db.delete(row._id);
        budget--;
      }
    }

    /* 14. documents */
    if (budget > 0) {
      const rows = await ctx.db
        .query("documents")
        .withIndex("by_projectId", (q) => q.eq("projectId", args.projectId))
        .take(budget);
      for (const row of rows) {
        await ctx.db.delete(row._id);
        budget--;
        documentsDeleted++;
      }
    }

    const remaining = await countProjectRemaining(ctx, args.projectId);
    return { remaining, documentsDeleted, mediaDeleted };
  },
});

/**
 * Final teardown. Idempotent — a re-run after partial failure is a no-op
 * if the project row is already gone, and is allowed to return `false`
 * (with a remaining count) if dependent rows still exist so the
 * orchestrator can loop more chunks instead of throwing into the UI.
 */
export const _deleteProjectRow = internalMutation({
  args: { projectId: v.id("projects") },
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

/** Counts still-pending rows across every project-scoped table. */
async function countProjectRemaining(
  ctx: { db: import("../_generated/server").MutationCtx["db"] },
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
  ]);
  let count = 0;
  for (const r of heads) count += r.length;
  return count;
}

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
