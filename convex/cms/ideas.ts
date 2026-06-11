/**
 * Idea inbox — per-project quick captures for future posts. Deliberately
 * minimal: list / create / remove. "Convert to draft" is client-side
 * orchestration (the existing `documents.create` mutation, then `remove`
 * here) so document-creation side effects stay in one place.
 */
import { v } from "convex/values";
import { mutation, query } from "../_generated/server";
import { getAuthedUserOrNull, getCurrentUser } from "../_lib/auth";
import { getRateLimitKey, rateLimiter } from "../_lib/rateLimits";

const MAX_IDEAS_PER_PROJECT = 200;
const MAX_TITLE_LENGTH = 200;
const MAX_NOTE_LENGTH = 2000;

export const list = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    const user = await getAuthedUserOrNull(ctx);
    if (!user) return [];

    const project = await ctx.db.get(args.projectId);
    if (!project || project.userId !== user._id) return [];

    const ideas = await ctx.db
      .query("ideas")
      .withIndex("by_projectId", (q) => q.eq("projectId", args.projectId))
      .order("desc")
      .take(MAX_IDEAS_PER_PROJECT);
    return ideas;
  },
});

export const create = mutation({
  args: {
    projectId: v.id("projects"),
    title: v.string(),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const key = await getRateLimitKey(ctx);
    await rateLimiter.limit(ctx, "ideas:create", { key, throws: true });

    const user = await getCurrentUser(ctx);
    const project = await ctx.db.get(args.projectId);
    if (!project || project.userId !== user._id) {
      throw new Error("Unauthorized: you do not own this project");
    }

    const title = args.title.trim().slice(0, MAX_TITLE_LENGTH);
    if (!title) throw new Error("Idea title is required");

    const note = args.note?.trim().slice(0, MAX_NOTE_LENGTH);

    return await ctx.db.insert("ideas", {
      projectId: args.projectId,
      userId: user._id,
      title,
      ...(note ? { note } : {}),
      createdAt: Date.now(),
    });
  },
});

export const remove = mutation({
  args: { ideaId: v.id("ideas") },
  handler: async (ctx, args) => {
    const key = await getRateLimitKey(ctx);
    await rateLimiter.limit(ctx, "ideas:remove", { key, throws: true });

    const user = await getCurrentUser(ctx);
    const idea = await ctx.db.get(args.ideaId);
    if (!idea || idea.userId !== user._id) {
      throw new Error("Idea not found");
    }
    await ctx.db.delete(args.ideaId);
  },
});
