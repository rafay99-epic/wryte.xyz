import { v } from "convex/values";
import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import {
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "../_generated/server";
import { getAuthedUserOrNull, getCurrentUser } from "../_lib/auth";
import {
  isBrowsableConfigPath,
  MAX_CONFIG_BYTES,
  MAX_CONFIG_DRAFTS,
  normalizeConfigPath,
  requireConfigFilePath,
} from "../_lib/configFiles";

const DRAFT_DISCARD_BATCH = 24;

const draftValidator = v.object({
  content: v.string(),
  baseSha: v.string(),
  updatedAt: v.number(),
});

async function ownedProjectOrNull(
  ctx: QueryCtx,
  projectId: Id<"projects">,
): Promise<Doc<"projects"> | null> {
  const user = await getAuthedUserOrNull(ctx);
  if (!user) return null;
  const project = await ctx.db.get(projectId);
  return project && project.userId === user._id ? project : null;
}

async function requireOwnedProject(
  ctx: MutationCtx,
  projectId: Id<"projects">,
): Promise<Doc<"projects">> {
  const user = await getCurrentUser(ctx);
  const project = await ctx.db.get(projectId);
  if (!project) throw new Error("Project not found");
  if (project.userId !== user._id) {
    throw new Error("Unauthorized: you do not own this project");
  }
  return project;
}

function draftByPath(
  ctx: QueryCtx,
  projectId: Id<"projects">,
  path: string,
): Promise<Doc<"config_drafts"> | null> {
  return ctx.db
    .query("config_drafts")
    .withIndex("by_projectId_and_path", (q) =>
      q.eq("projectId", projectId).eq("path", path),
    )
    .unique();
}

async function folderDrafts(
  ctx: QueryCtx,
  project: Doc<"projects">,
): Promise<Doc<"config_drafts">[]> {
  const root = normalizeConfigPath(project.configPath ?? "");
  if (root === "") return [];
  return await ctx.db
    .query("config_drafts")
    .withIndex("by_projectId_and_path", (q) =>
      q
        .eq("projectId", project._id)
        .gte("path", `${root}/`)
        .lt("path", `${root}0`),
    )
    .take(MAX_CONFIG_DRAFTS);
}

async function discardDraftsOutsideFolder(
  ctx: MutationCtx,
  projectId: Id<"projects">,
  root: string,
): Promise<void> {
  const before = await ctx.db
    .query("config_drafts")
    .withIndex("by_projectId_and_path", (q) =>
      root === ""
        ? q.eq("projectId", projectId)
        : q.eq("projectId", projectId).lt("path", `${root}/`),
    )
    .take(DRAFT_DISCARD_BATCH);
  const after =
    root === "" || before.length === DRAFT_DISCARD_BATCH
      ? []
      : await ctx.db
          .query("config_drafts")
          .withIndex("by_projectId_and_path", (q) =>
            q.eq("projectId", projectId).gte("path", `${root}0`),
          )
          .take(DRAFT_DISCARD_BATCH - before.length);
  for (const draft of [...before, ...after]) await ctx.db.delete(draft._id);
  if (before.length + after.length === DRAFT_DISCARD_BATCH) {
    await ctx.scheduler.runAfter(
      0,
      internal.cms.configFiles._discardDraftsOutsideFolder,
      { projectId },
    );
  }
}

export const listDrafts = query({
  args: { projectId: v.id("projects") },
  returns: v.array(v.object({ path: v.string(), updatedAt: v.number() })),
  handler: async (ctx, args) => {
    const project = await ownedProjectOrNull(ctx, args.projectId);
    if (!project) return [];
    const drafts = await folderDrafts(ctx, project);
    return drafts.map((draft) => ({
      path: draft.path,
      updatedAt: draft.updatedAt,
    }));
  },
});

export const getDraft = query({
  args: { projectId: v.id("projects"), path: v.string() },
  returns: v.union(v.null(), draftValidator),
  handler: async (ctx, args) => {
    const project = await ownedProjectOrNull(ctx, args.projectId);
    if (!project) return null;
    const draft = await draftByPath(ctx, args.projectId, args.path);
    if (!draft) return null;
    return {
      content: draft.content,
      baseSha: draft.baseSha,
      updatedAt: draft.updatedAt,
    };
  },
});

export const setFolder = mutation({
  args: { projectId: v.id("projects"), path: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const project = await requireOwnedProject(ctx, args.projectId);
    const root = normalizeConfigPath(args.path);
    if (root !== "" && !isBrowsableConfigPath(root)) {
      throw new Error("That folder can't be used for config files.");
    }
    const now = Date.now();
    if (root === "") {
      await ctx.db.patch(project._id, {
        configPath: undefined,
        updatedAt: now,
      });
    } else {
      await ctx.db.patch(project._id, { configPath: root, updatedAt: now });
    }
    await discardDraftsOutsideFolder(ctx, project._id, root);
    return null;
  },
});

export const _discardDraftsOutsideFolder = internalMutation({
  args: { projectId: v.id("projects") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const project = await ctx.db.get(args.projectId);
    if (!project) return null;
    await discardDraftsOutsideFolder(
      ctx,
      project._id,
      normalizeConfigPath(project.configPath ?? ""),
    );
    return null;
  },
});

export const saveDraft = mutation({
  args: {
    projectId: v.id("projects"),
    path: v.string(),
    content: v.string(),
    baseSha: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const project = await requireOwnedProject(ctx, args.projectId);
    requireConfigFilePath(project.configPath, args.path);
    if (new TextEncoder().encode(args.content).length > MAX_CONFIG_BYTES) {
      throw new Error("This file is too large to edit here (512 KB limit).");
    }
    const now = Date.now();
    const existing = await draftByPath(ctx, project._id, args.path);
    if (existing) {
      await ctx.db.patch(existing._id, {
        content: args.content,
        baseSha: args.baseSha,
        updatedAt: now,
      });
      return null;
    }
    const drafts = await folderDrafts(ctx, project);
    if (drafts.length >= MAX_CONFIG_DRAFTS) {
      throw new Error(
        "Too many unpublished config files. Publish or discard some first.",
      );
    }
    await ctx.db.insert("config_drafts", {
      projectId: project._id,
      userId: project.userId,
      path: args.path,
      content: args.content,
      baseSha: args.baseSha,
      updatedAt: now,
    });
    return null;
  },
});

export const discardDraft = mutation({
  args: { projectId: v.id("projects"), path: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const project = await requireOwnedProject(ctx, args.projectId);
    const draft = await draftByPath(ctx, project._id, args.path);
    if (draft) await ctx.db.delete(draft._id);
    return null;
  },
});

export const _getDraft = internalQuery({
  args: { projectId: v.id("projects"), path: v.string() },
  returns: v.union(v.null(), draftValidator),
  handler: async (ctx, args) => {
    const draft = await draftByPath(ctx, args.projectId, args.path);
    if (!draft) return null;
    return {
      content: draft.content,
      baseSha: draft.baseSha,
      updatedAt: draft.updatedAt,
    };
  },
});

export const _settlePublishedDraft = internalMutation({
  args: {
    projectId: v.id("projects"),
    path: v.string(),
    publishedUpdatedAt: v.number(),
    newSha: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const draft = await draftByPath(ctx, args.projectId, args.path);
    if (!draft) return null;
    if (draft.updatedAt === args.publishedUpdatedAt) {
      await ctx.db.delete(draft._id);
    } else {
      await ctx.db.patch(draft._id, { baseSha: args.newSha });
    }
    return null;
  },
});
