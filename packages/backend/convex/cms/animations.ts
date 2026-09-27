import { v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { internalQuery, mutation, query } from "../_generated/server";
import type { AnimationCheckRecord } from "../_lib/animationChecks";
import { hashAnimationSource } from "../_lib/animationChecks";
import { getAuthedUserOrNull, getCurrentUser } from "../_lib/auth";
import { getRateLimitKey, rateLimiter } from "../_lib/rateLimits";

const MAX_ANIMATIONS = 200;
const MAX_ANIMATION_NAME = 60;
const MAX_ANIMATION_SOURCE = 100_000;

const NAME_RE = /^[A-Z][A-Za-z0-9]*$/;

const RESERVED_NAMES = new Set(["Fragment", "React", "Component", "Suspense"]);

export const checkSummaryValidator = v.object({
  status: v.union(v.literal("pass"), v.literal("warn"), v.literal("fail")),
  errorCount: v.number(),
  warningCount: v.number(),
});

type CheckSummary = {
  status: AnimationCheckRecord["status"];
  errorCount: number;
  warningCount: number;
};

function toCheckRecord(
  source: string,
  summary: CheckSummary | undefined,
): AnimationCheckRecord | undefined {
  if (summary === undefined) return undefined;
  return {
    sourceHash: hashAnimationSource(source),
    status: summary.status,
    errorCount: summary.errorCount,
    warningCount: summary.warningCount,
    checkedAt: Date.now(),
  };
}

export type AnimationView = {
  _id: Id<"animations">;
  name: string;
  source: string;
  updatedAt: number;
};
const toView = (d: Doc<"animations">): AnimationView => ({
  _id: d._id,
  name: d.name,
  source: d.source,
  updatedAt: d.updatedAt,
});

async function ownedProjectForQuery(
  ctx: QueryCtx,
  projectId: Id<"projects">,
): Promise<Doc<"projects"> | null> {
  const user = await getAuthedUserOrNull(ctx);
  if (!user) return null;
  return await ownedProjectForUser(ctx, user._id, projectId);
}

async function ownedProjectForUser(
  ctx: QueryCtx,
  userId: Id<"users">,
  projectId: Id<"projects">,
): Promise<Doc<"projects"> | null> {
  const project = await ctx.db.get(projectId);
  if (!project || project.userId !== userId) return null;
  return project;
}

async function requireOwnedProject(
  ctx: MutationCtx,
  projectId: Id<"projects">,
): Promise<Doc<"projects">> {
  const user = await getCurrentUser(ctx);
  return await requireOwnedProjectForUser(ctx, user, projectId);
}

async function requireOwnedProjectForUser(
  ctx: MutationCtx,
  user: Doc<"users">,
  projectId: Id<"projects">,
): Promise<Doc<"projects">> {
  const project = await ctx.db.get(projectId);
  if (!project) throw new Error("Project not found");
  if (project.userId !== user._id) {
    throw new Error("Unauthorized: you do not own this project");
  }
  return project;
}

async function insertNameRow(
  ctx: MutationCtx,
  projectId: Id<"projects">,
  name: string,
): Promise<void> {
  await ctx.db.insert("animation_names", { projectId, name });
}

async function deleteNameRow(
  ctx: MutationCtx,
  projectId: Id<"projects">,
  name: string,
): Promise<void> {
  const existing = await ctx.db
    .query("animation_names")
    .withIndex("by_project_and_name", (q) =>
      q.eq("projectId", projectId).eq("name", name),
    )
    .unique();
  if (existing) await ctx.db.delete(existing._id);
}

function normalizeName(raw: string): string {
  const name = raw.trim();
  if (!name) throw new Error("Component name is required");
  if (name.length > MAX_ANIMATION_NAME) {
    throw new Error(
      `Component name must be ${String(MAX_ANIMATION_NAME)} characters or fewer`,
    );
  }
  if (!NAME_RE.test(name)) {
    throw new Error(
      "Component name must be PascalCase — start with a capital letter, letters and digits only (e.g. HarnessLoop)",
    );
  }
  if (RESERVED_NAMES.has(name)) {
    throw new Error(`"${name}" is a reserved name — pick another`);
  }
  return name;
}

function validateSource(raw: string): string {
  if (!raw.trim()) throw new Error("Component source is required");
  if (raw.length > MAX_ANIMATION_SOURCE) {
    throw new Error(
      `Component source must be ${String(MAX_ANIMATION_SOURCE)} characters or fewer`,
    );
  }
  return raw;
}

export const listNames = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    const project = await ownedProjectForQuery(ctx, args.projectId);
    if (!project) return [];
    const rows = await ctx.db
      .query("animations")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .order("desc")
      .take(MAX_ANIMATIONS);
    return rows.map((d) => ({
      _id: d._id,
      name: d.name,
      updatedAt: d.updatedAt,
      checkStatus: d.check?.status ?? null,
    }));
  },
});

export async function animationsListForUser(
  ctx: QueryCtx,
  userId: Id<"users">,
  projectId: Id<"projects">,
): Promise<AnimationView[]> {
  const project = await ownedProjectForUser(ctx, userId, projectId);
  if (!project) return [];
  const rows = await ctx.db
    .query("animations")
    .withIndex("by_project", (q) => q.eq("projectId", projectId))
    .order("desc")
    .take(MAX_ANIMATIONS);
  return rows.map(toView);
}

export const list = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args): Promise<AnimationView[]> => {
    const project = await ownedProjectForQuery(ctx, args.projectId);
    if (!project) return [];
    const rows = await ctx.db
      .query("animations")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .order("desc")
      .take(MAX_ANIMATIONS);
    return rows.map(toView);
  },
});

export async function animationSourceForUser(
  ctx: QueryCtx,
  userId: Id<"users">,
  animationId: Id<"animations">,
): Promise<string | null> {
  const row = await ctx.db.get(animationId);
  if (!row) return null;
  const project = await ownedProjectForUser(ctx, userId, row.projectId);
  if (!project) return null;
  return row.source;
}

export const getSource = query({
  args: { animationId: v.id("animations") },
  returns: v.union(v.string(), v.null()),
  handler: async (ctx, args): Promise<string | null> => {
    const row = await ctx.db.get(args.animationId);
    if (!row) return null;
    const project = await ownedProjectForQuery(ctx, row.projectId);
    if (!project) return null;
    return row.source;
  },
});

export const usage = query({
  args: { projectId: v.id("projects"), name: v.string() },
  handler: async (
    ctx,
    args,
  ): Promise<{
    posts: { documentId: Id<"documents">; title: string }[];
    truncated: boolean;
  }> => {
    const project = await ownedProjectForQuery(ctx, args.projectId);
    if (!project) return { posts: [], truncated: false };
    if (!NAME_RE.test(args.name)) return { posts: [], truncated: false };

    const tagRe = new RegExp(`<${args.name}[\\s/>]`);
    const SCAN_LIMIT = 500;
    const rows = await ctx.db
      .query("document_content")
      .withIndex("by_projectId", (q) => q.eq("projectId", args.projectId))
      .take(SCAN_LIMIT + 1);
    const truncated = rows.length > SCAN_LIMIT;

    const posts: { documentId: Id<"documents">; title: string }[] = [];
    for (const row of rows.slice(0, SCAN_LIMIT)) {
      if (!tagRe.test(row.content)) continue;
      const doc = await ctx.db.get(row.documentId);
      if (doc && doc.trashedAt === undefined) {
        posts.push({ documentId: doc._id, title: doc.title });
      }
    }
    return { posts, truncated };
  },
});

export const checkNames = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args): Promise<string[]> => {
    const project = await ownedProjectForQuery(ctx, args.projectId);
    if (!project) return [];
    const rows = await ctx.db
      .query("animation_names")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .take(MAX_ANIMATIONS);
    return rows.map((r) => r.name);
  },
});

export const internalListByProject = internalQuery({
  args: { projectId: v.id("projects") },
  handler: async (
    ctx,
    args,
  ): Promise<
    { name: string; source: string; check: AnimationCheckRecord | undefined }[]
  > => {
    const rows = await ctx.db
      .query("animations")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .take(MAX_ANIMATIONS);
    return rows.map((d) => ({
      name: d.name,
      source: d.source,
      check: d.check,
    }));
  },
});

export async function createAnimationForUser(
  ctx: MutationCtx,
  user: Doc<"users">,
  args: {
    projectId: Id<"projects">;
    name: string;
    source: string;
    check?: CheckSummary | undefined;
  },
): Promise<AnimationView> {
  await rateLimiter.limit(ctx, "animations:create", {
    key: user.tokenIdentifier,
    throws: true,
  });

  await requireOwnedProjectForUser(ctx, user, args.projectId);

  const name = normalizeName(args.name);
  const source = validateSource(args.source);

  const existing = await ctx.db
    .query("animations")
    .withIndex("by_project_and_name", (q) =>
      q.eq("projectId", args.projectId).eq("name", name),
    )
    .unique();
  if (existing) {
    throw new Error(
      `An animation named "${name}" already exists in this project`,
    );
  }

  const all = await ctx.db
    .query("animations")
    .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
    .take(MAX_ANIMATIONS);
  if (all.length >= MAX_ANIMATIONS) {
    throw new Error(
      `You've reached the limit of ${String(MAX_ANIMATIONS)} animations for this project.`,
    );
  }

  const now = Date.now();
  const check = toCheckRecord(source, args.check);
  const animationId = await ctx.db.insert("animations", {
    projectId: args.projectId,
    name,
    source,
    updatedAt: now,
    ...(check === undefined ? {} : { check }),
  });

  await insertNameRow(ctx, args.projectId, name);

  return { _id: animationId, name, source, updatedAt: now };
}

export const create = mutation({
  args: {
    projectId: v.id("projects"),
    name: v.string(),
    source: v.string(),
    check: v.optional(checkSummaryValidator),
  },
  handler: async (ctx, args): Promise<AnimationView> =>
    await createAnimationForUser(ctx, await getCurrentUser(ctx), args),
});

export async function updateAnimationForUser(
  ctx: MutationCtx,
  user: Doc<"users">,
  args: {
    animationId: Id<"animations">;
    source: string;
    check?: CheckSummary | undefined;
  },
): Promise<null> {
  await rateLimiter.limit(ctx, "animations:update", {
    key: user.tokenIdentifier,
    throws: true,
  });

  const animation = await ctx.db.get(args.animationId);
  if (!animation) throw new Error("Animation not found");
  await requireOwnedProjectForUser(ctx, user, animation.projectId);

  const source = validateSource(args.source);
  await ctx.db.patch(args.animationId, {
    source,
    updatedAt: Date.now(),
    check: toCheckRecord(source, args.check),
  });
  return null;
}

export const update = mutation({
  args: {
    animationId: v.id("animations"),
    source: v.string(),
    check: v.optional(checkSummaryValidator),
  },
  handler: async (ctx, args): Promise<null> =>
    await updateAnimationForUser(ctx, await getCurrentUser(ctx), args),
});

export const duplicate = mutation({
  args: {
    projectId: v.id("projects"),
    animationId: v.id("animations"),
    newName: v.string(),
  },
  returns: v.string(),
  handler: async (ctx, args): Promise<string> => {
    const key = await getRateLimitKey(ctx);
    await rateLimiter.limit(ctx, "animations:create", { key, throws: true });

    await requireOwnedProject(ctx, args.projectId);

    const original = await ctx.db.get(args.animationId);
    if (!original) throw new Error("Original animation not found");

    const newName = normalizeName(args.newName);
    const source = original.source;

    const existing = await ctx.db
      .query("animations")
      .withIndex("by_project_and_name", (q) =>
        q.eq("projectId", args.projectId).eq("name", newName),
      )
      .unique();
    if (existing) {
      throw new Error(`An animation named "${newName}" already exists`);
    }

    const now = Date.now();
    await ctx.db.insert("animations", {
      projectId: args.projectId,
      name: newName,
      source,
      updatedAt: now,
    });
    await insertNameRow(ctx, args.projectId, newName);

    return newName;
  },
});

export async function replaceAnimationByNameForUser(
  ctx: MutationCtx,
  user: Doc<"users">,
  args: {
    projectId: Id<"projects">;
    name: string;
    source: string;
  },
): Promise<null> {
  await rateLimiter.limit(ctx, "animations:update", {
    key: user.tokenIdentifier,
    throws: true,
  });

  await requireOwnedProjectForUser(ctx, user, args.projectId);

  const row = await ctx.db
    .query("animations")
    .withIndex("by_project_and_name", (q) =>
      q.eq("projectId", args.projectId).eq("name", normalizeName(args.name)),
    )
    .unique();
  if (!row) {
    throw new Error(`Animation "${args.name}" not found in this project`);
  }

  await ctx.db.patch(row._id, {
    source: validateSource(args.source),
    updatedAt: Date.now(),
    check: undefined,
  });
  return null;
}

export const replaceByName = mutation({
  args: {
    projectId: v.id("projects"),
    name: v.string(),
    source: v.string(),
  },
  handler: async (ctx, args): Promise<null> =>
    await replaceAnimationByNameForUser(ctx, await getCurrentUser(ctx), args),
});

export async function removeAnimationForUser(
  ctx: MutationCtx,
  user: Doc<"users">,
  args: { animationId: Id<"animations"> },
): Promise<null> {
  await rateLimiter.limit(ctx, "animations:remove", {
    key: user.tokenIdentifier,
    throws: true,
  });

  const animation = await ctx.db.get(args.animationId);
  if (!animation) return null;
  await requireOwnedProjectForUser(ctx, user, animation.projectId);

  await deleteNameRow(ctx, animation.projectId, animation.name);
  await ctx.db.delete(args.animationId);
  return null;
}

export const remove = mutation({
  args: { animationId: v.id("animations") },
  handler: async (ctx, args): Promise<null> =>
    await removeAnimationForUser(ctx, await getCurrentUser(ctx), args),
});
