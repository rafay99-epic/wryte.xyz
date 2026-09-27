import { mcpCallerValidator } from "convex-mcp-gateway";
import type { Doc } from "../../_generated/dataModel";
import { internalQuery } from "../../_generated/server";
import { requireCaller } from "../../_lib/auth";
import { projectsForUser } from "../../cms/projects";

function projectSummary(project: Doc<"projects">) {
  return {
    projectId: project._id,
    name: project.name,
    slug: project.slug,
    githubRepo: project.githubRepo ?? null,
    githubBranch: project.githubBranch ?? null,
    contentPath: project.contentPath ?? null,
    mediaStorageMode: project.mediaStorageMode ?? "github",
  };
}

export const list = internalQuery({
  args: { caller: mcpCallerValidator },
  handler: async (ctx, args) => {
    const user = await requireCaller(ctx, args.caller);
    const projects = await projectsForUser(ctx, user._id);
    return projects.map(projectSummary);
  },
});
