"use node";

import { v } from "convex/values";
import { mcpCallerValidator } from "convex-mcp-gateway";
import { internalAction } from "../../_generated/server";
import { requireCallerInAction } from "../../_lib/auth";
import { publishForUser } from "../../integrations/github";
import { listMediaForUser, uploadBase64ForUser } from "../../media/uploads";

export const publish = internalAction({
  args: {
    caller: mcpCallerValidator,
    documentId: v.id("documents"),
    commitMessage: v.optional(v.string()),
    socialPostText: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireCallerInAction(ctx, args.caller);
    const { caller: _caller, ...rest } = args;
    return await publishForUser(ctx, user, rest);
  },
});

export const mediaList = internalAction({
  args: {
    caller: mcpCallerValidator,
    projectId: v.id("projects"),
    cursor: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await requireCallerInAction(ctx, args.caller);
    const { caller: _caller, ...rest } = args;
    return await listMediaForUser(ctx, user, rest);
  },
});

export const mediaUpload = internalAction({
  args: {
    caller: mcpCallerValidator,
    projectId: v.id("projects"),
    base64: v.string(),
    mime: v.string(),
    filename: v.string(),
    documentId: v.optional(v.id("documents")),
  },
  handler: async (ctx, args) => {
    const user = await requireCallerInAction(ctx, args.caller);
    const { caller: _caller, ...rest } = args;
    return await uploadBase64ForUser(ctx, user, rest);
  },
});
