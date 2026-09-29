import { v } from "convex/values";
import { mcpCallerValidator } from "convex-mcp-gateway";
import type { Doc } from "../../_generated/dataModel";
import { requireCaller } from "../../_lib/auth";
import { projectsForUser } from "../../cms/projects";
import { agentQuery } from "../agentFunctions";
import { projectContext } from "../projectContext";

function projectSummary(project: Doc<"projects">) {
  return {
    projectId: project._id,
    name: project.name,
    slug: project.slug,
    githubRepo: project.githubRepo ?? null,
    githubBranch: project.githubBranch ?? null,
    contentPath: project.contentPath ?? null,
    contentFormat: project.contentFormat ?? "md",
    mediaStorageMode: project.mediaStorageMode ?? "github",
  };
}

export const list = agentQuery({
  args: { caller: mcpCallerValidator },
  handler: async (ctx, args) => {
    const user = await requireCaller(ctx, args.caller);
    const projects = await projectsForUser(ctx, user._id);
    return projects.map(projectSummary);
  },
});

export const context = agentQuery({
  args: { caller: mcpCallerValidator, projectId: v.id("projects") },
  handler: async (ctx, args) => {
    const user = await requireCaller(ctx, args.caller);
    const project = await ctx.db.get(args.projectId);
    if (!project || project.userId !== user._id) {
      throw new Error("Project not found");
    }
    return projectContext(project);
  },
});
