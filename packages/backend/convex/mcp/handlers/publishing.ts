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
