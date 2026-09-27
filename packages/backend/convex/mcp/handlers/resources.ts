import { v } from "convex/values";
import { mcpCallerValidator } from "convex-mcp-gateway";
import { internalQuery } from "../../_generated/server";
import { requireCaller } from "../../_lib/auth";
import { documentWithContentForUser } from "../../cms/documents";

export const project = internalQuery({
  args: { caller: mcpCallerValidator, projectId: v.string() },
  handler: async (ctx, args) => {
    const user = await requireCaller(ctx, args.caller);
    const projectId = ctx.db.normalizeId("projects", args.projectId);
    if (!projectId) return null;
    const project = await ctx.db.get(projectId);
    if (!project) return null;
    if (project.userId !== user._id) {
      throw new Error("Unauthorized: you do not own this project");
    }
    return project;
  },
});

export const document = internalQuery({
  args: { caller: mcpCallerValidator, documentId: v.string() },
  handler: async (ctx, args) => {
    const user = await requireCaller(ctx, args.caller);
    const documentId = ctx.db.normalizeId("documents", args.documentId);
    if (!documentId) return null;
    return await documentWithContentForUser(ctx, user._id, documentId);
  },
});
