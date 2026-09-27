import { v } from "convex/values";
import { mcpCallerValidator } from "convex-mcp-gateway";
import { internalMutation, internalQuery } from "../../_generated/server";
import { requireCaller } from "../../_lib/auth";
import {
  animationSourceForUser,
  animationsListForUser,
  createAnimationForUser,
  removeAnimationForUser,
  replaceAnimationByNameForUser,
  updateAnimationForUser,
} from "../../cms/animations";

export const list = internalQuery({
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

export const getSource = internalQuery({
  args: { caller: mcpCallerValidator, animationId: v.id("animations") },
  handler: async (ctx, args) => {
    const user = await requireCaller(ctx, args.caller);
    return await animationSourceForUser(ctx, user._id, args.animationId);
  },
});

export const create = internalMutation({
  args: {
    caller: mcpCallerValidator,
    projectId: v.id("projects"),
    name: v.string(),
    source: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requireCaller(ctx, args.caller);
    const { caller: _caller, ...rest } = args;
    return await createAnimationForUser(ctx, user, rest);
  },
});

export const update = internalMutation({
  args: {
    caller: mcpCallerValidator,
    animationId: v.id("animations"),
    source: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requireCaller(ctx, args.caller);
    const { caller: _caller, ...rest } = args;
    return await updateAnimationForUser(ctx, user, rest);
  },
});

export const replaceByName = internalMutation({
  args: {
    caller: mcpCallerValidator,
    projectId: v.id("projects"),
    name: v.string(),
    source: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requireCaller(ctx, args.caller);
    const { caller: _caller, ...rest } = args;
    return await replaceAnimationByNameForUser(ctx, user, rest);
  },
});

export const remove = internalMutation({
  args: { caller: mcpCallerValidator, animationId: v.id("animations") },
  handler: async (ctx, args) => {
    const user = await requireCaller(ctx, args.caller);
    return await removeAnimationForUser(ctx, user, {
      animationId: args.animationId,
    });
  },
});
