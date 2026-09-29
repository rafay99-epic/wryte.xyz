import { v } from "convex/values";
import { mcpCallerValidator } from "convex-mcp-gateway";
import { resolveAnimationLanguage } from "../../_lib/animationChecks";
import { requireCaller } from "../../_lib/auth";
import {
  animationSourceForUser,
  animationsListForUser,
  checkSummaryValidator,
  removeAnimationForUser,
  upsertAnimationForUser,
} from "../../cms/animations";
import { agentMutation, agentQuery } from "../agentFunctions";
import { animationsEnabled } from "../projectContext";

export const list = agentQuery({
  args: { caller: mcpCallerValidator, projectId: v.id("projects") },
  handler: async (ctx, args) => {
    const user = await requireCaller(ctx, args.caller);
    const animations = await animationsListForUser(
      ctx,
      user._id,
      args.projectId,
    );
    return animations.map(({ source: _source, ...meta }) => meta);
  },
});

export const getSource = agentQuery({
  args: { caller: mcpCallerValidator, animationId: v.id("animations") },
  handler: async (ctx, args) => {
    const user = await requireCaller(ctx, args.caller);
    return await animationSourceForUser(ctx, user._id, args.animationId);
  },
});

export const policy = agentQuery({
  args: { caller: mcpCallerValidator, projectId: v.id("projects") },
  handler: async (ctx, args) => {
    const user = await requireCaller(ctx, args.caller);
    const project = await ctx.db.get(args.projectId);
    if (!project || project.userId !== user._id) {
      throw new Error("Project not found");
    }
    if (!animationsEnabled(project)) {
      throw new Error(
        "Code animations are off for this project. The user can turn them on in project settings.",
      );
    }
    return {
      level: project.animationChecks?.level ?? "off",
      language: resolveAnimationLanguage(project.animationLanguage),
    };
  },
});

export const write = agentMutation({
  args: {
    caller: mcpCallerValidator,
    projectId: v.id("projects"),
    name: v.string(),
    source: v.string(),
    check: v.optional(checkSummaryValidator),
  },
  handler: async (ctx, args) => {
    const user = await requireCaller(ctx, args.caller);
    const { caller: _caller, ...rest } = args;
    return await upsertAnimationForUser(ctx, user, rest);
  },
});

export const remove = agentMutation({
  args: { caller: mcpCallerValidator, animationId: v.id("animations") },
  handler: async (ctx, args) => {
    const user = await requireCaller(ctx, args.caller);
    return await removeAnimationForUser(ctx, user, {
      animationId: args.animationId,
    });
  },
});
