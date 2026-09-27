import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { mutation, query } from "../_generated/server";
import { getAuthedUserOrNull, getCurrentUser } from "../_lib/auth";
import { getRateLimitKey, rateLimiter } from "../_lib/rateLimits";

const MAX_SNIPPETS = 1000;
const MAX_SNIPPET_NAME = 60;
const MAX_SNIPPET_CONTENT = 8000;
const SNIPPET_SEARCH_LIMIT = 20;

type SnippetView = { _id: Id<"snippets">; name: string; content: string };
const toView = (d: Doc<"snippets">): SnippetView => ({
  _id: d._id,
  name: d.name,
  content: d.content,
});

async function ownedProjectForQuery(
  ctx: QueryCtx,
  projectId: Id<"projects">,
): Promise<Doc<"projects"> | null> {
  const user = await getAuthedUserOrNull(ctx);
  if (!user) return null;
  const project = await ctx.db.get(projectId);
  if (!project || project.userId !== user._id) return null;
  return project;
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

function normalizeName(raw: string): string {
  const name = raw.trim();
  if (!name) throw new Error("Snippet name is required");
  if (name.length > MAX_SNIPPET_NAME) {
    throw new Error(
      `Snippet name must be ${String(MAX_SNIPPET_NAME)} characters or fewer`,
    );
  }
  return name;
}

function validateContent(raw: string): string {
  if (raw.length > MAX_SNIPPET_CONTENT) {
    throw new Error(
      `Snippet content must be ${String(MAX_SNIPPET_CONTENT)} characters or fewer`,
    );
  }
  return raw;
}

export const list = query({
  args: {
    projectId: v.id("projects"),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const project = await ownedProjectForQuery(ctx, args.projectId);
    if (!project) {
      return { page: [] as SnippetView[], isDone: true, continueCursor: "" };
    }
    const result = await ctx.db
      .query("snippets")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .order("desc")
      .paginate(args.paginationOpts);
    return { ...result, page: result.page.map(toView) };
  },
});

export const search = query({
  args: { projectId: v.id("projects"), term: v.string() },
  handler: async (ctx, args): Promise<SnippetView[]> => {
    const project = await ownedProjectForQuery(ctx, args.projectId);
    if (!project) return [];

    const term = args.term.trim();
    if (!term) {
      const recents = await ctx.db
        .query("snippets")
        .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
        .order("desc")
        .take(SNIPPET_SEARCH_LIMIT);
      return recents.map(toView);
    }

    const matches = await ctx.db
      .query("snippets")
      .withSearchIndex("search_name", (q) =>
        q.search("name", term).eq("projectId", args.projectId),
      )
      .take(SNIPPET_SEARCH_LIMIT);
    return matches.map(toView);
  },
});

export const create = mutation({
  args: {
    projectId: v.id("projects"),
    name: v.string(),
    content: v.string(),
  },
  handler: async (ctx, args): Promise<SnippetView> => {
    const key = await getRateLimitKey(ctx);
    await rateLimiter.limit(ctx, "snippets:create", { key, throws: true });

    const project = await requireOwnedProject(ctx, args.projectId);

    const count = project.snippetCount ?? 0;
    if (count >= MAX_SNIPPETS) {
      throw new Error(
        `You've reached the limit of ${String(MAX_SNIPPETS)} snippets for this project.`,
      );
    }

    const name = normalizeName(args.name);
    const content = validateContent(args.content);

    const snippetId = await ctx.db.insert("snippets", {
      projectId: args.projectId,
      name,
      content,
      updatedAt: Date.now(),
    });
    await ctx.db.patch(args.projectId, { snippetCount: count + 1 });

    return { _id: snippetId, name, content };
  },
});

export const update = mutation({
  args: {
    snippetId: v.id("snippets"),
    name: v.optional(v.string()),
    content: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<null> => {
    const key = await getRateLimitKey(ctx);
    await rateLimiter.limit(ctx, "snippets:update", { key, throws: true });

    const snippet = await ctx.db.get(args.snippetId);
    if (!snippet) throw new Error("Snippet not found");
    await requireOwnedProject(ctx, snippet.projectId);

    const patch: Partial<Doc<"snippets">> = { updatedAt: Date.now() };
    if (args.name !== undefined) patch.name = normalizeName(args.name);
    if (args.content !== undefined)
      patch.content = validateContent(args.content);

    await ctx.db.patch(args.snippetId, patch);
    return null;
  },
});

export const remove = mutation({
  args: { snippetId: v.id("snippets") },
  handler: async (ctx, args): Promise<null> => {
    const key = await getRateLimitKey(ctx);
    await rateLimiter.limit(ctx, "snippets:remove", { key, throws: true });

    const snippet = await ctx.db.get(args.snippetId);
    if (!snippet) return null;
    const project = await requireOwnedProject(ctx, snippet.projectId);

    await ctx.db.delete(args.snippetId);
    await ctx.db.patch(project._id, {
      snippetCount: Math.max(0, (project.snippetCount ?? 1) - 1),
    });
    return null;
  },
});
