import { v } from "convex/values";
import { mcpCallerValidator } from "convex-mcp-gateway";
import { requireCaller } from "../../_lib/auth";
import { dashboardStatsForUser } from "../../analytics/writingStats";
import { restoreTrashedForUser } from "../../cms/trash";
import { agentMutation, agentQuery } from "../agentFunctions";

export const stats = agentQuery({
  args: { caller: mcpCallerValidator },
  handler: async (ctx, args) => {
    const user = await requireCaller(ctx, args.caller);
    return await dashboardStatsForUser(ctx, user._id);
  },
});

export const trashRestore = agentMutation({
  args: { caller: mcpCallerValidator, documentId: v.id("documents") },
  handler: async (ctx, args) => {
    const user = await requireCaller(ctx, args.caller);
    return await restoreTrashedForUser(ctx, user, args.documentId);
  },
});
