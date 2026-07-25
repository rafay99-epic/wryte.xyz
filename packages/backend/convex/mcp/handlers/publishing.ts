/**
 * MCP handlers for scheduling, stats and trash restore.
 *
 * Same contract as `./projects.ts`: `internal*` only, actor injected by the
 * gateway via `identityArg`, zero business logic.
 *
 * Handlers whose target lives in a `"use node"` module (GitHub publishing,
 * media) are in `./nodeActions.ts` instead — importing a `"use node"` module
 * from here would pull Node built-ins into the Convex runtime bundle and fail
 * the build.
 */
import { v } from "convex/values";
import { mcpCallerValidator } from "convex-mcp-gateway";
import { internalMutation, internalQuery } from "../../_generated/server";
import { requireCaller } from "../../_lib/auth";
import { dashboardStatsForUser } from "../../analytics/writingStats";
import { restoreTrashedForUser } from "../../cms/trash";
import {
  cancelScheduleForUser,
  scheduleForUser,
} from "../../integrations/scheduling";

export const scheduleSet = internalMutation({
  args: {
    caller: mcpCallerValidator,
    documentId: v.id("documents"),
    scheduledAt: v.number(),
    socialPostText: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireCaller(ctx, args.caller);
    const { caller: _caller, ...rest } = args;
    return await scheduleForUser(ctx, user, rest);
  },
});

export const scheduleCancel = internalMutation({
  args: { caller: mcpCallerValidator, documentId: v.id("documents") },
  handler: async (ctx, args) => {
    const user = await requireCaller(ctx, args.caller);
    return await cancelScheduleForUser(ctx, user, {
      documentId: args.documentId,
    });
  },
});

export const stats = internalQuery({
  args: { caller: mcpCallerValidator },
  handler: async (ctx, args) => {
    const user = await requireCaller(ctx, args.caller);
    return await dashboardStatsForUser(ctx, user._id);
  },
});

export const trashRestore = internalMutation({
  args: { caller: mcpCallerValidator, documentId: v.id("documents") },
  handler: async (ctx, args) => {
    const user = await requireCaller(ctx, args.caller);
    return await restoreTrashedForUser(ctx, user, args.documentId);
  },
});
