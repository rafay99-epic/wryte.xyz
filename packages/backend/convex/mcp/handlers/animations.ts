/**
 * MCP handlers for animation (code component) operations.
 *
 * Same contract as `./documents.ts`: `internal*` only, actor injected by the
 * gateway via `identityArg`, zero business logic — every handler resolves the
 * caller and delegates to the helper the public function also uses, so the
 * two entry points cannot drift.
 */
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

/* ------------------------------- reads -------------------------------- */

export const list = internalQuery({
  args: { caller: mcpCallerValidator, projectId: v.id("projects") },
  handler: async (ctx, args) => {
    const user = await requireCaller(ctx, args.caller);
    return await animationsListForUser(ctx, user._id, args.projectId);
  },
});

export const getSource = internalQuery({
  args: { caller: mcpCallerValidator, animationId: v.id("animations") },
  handler: async (ctx, args) => {
    const user = await requireCaller(ctx, args.caller);
    return await animationSourceForUser(ctx, user._id, args.animationId);
  },
});

/* ------------------------------- writes ------------------------------- */

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
