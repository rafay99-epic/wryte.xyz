import { v } from "convex/values";
import { mcpCallerValidator } from "convex-mcp-gateway";
import { requireCaller } from "../../_lib/auth";
import { documentForUser } from "../../cms/documents";
import { agentQuery } from "../agentFunctions";
import { agentDocumentView } from "../documentView";
import { projectContext } from "../projectContext";

export const project = agentQuery({
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
    return projectContext(project);
  },
});

export const document = agentQuery({
  args: { caller: mcpCallerValidator, documentId: v.string() },
  handler: async (ctx, args) => {
    const user = await requireCaller(ctx, args.caller);
    const documentId = ctx.db.normalizeId("documents", args.documentId);
    if (!documentId) return null;
    const document = await documentForUser(ctx, user._id, documentId);
    return document ? agentDocumentView(document) : null;
  },
});
