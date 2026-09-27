/**
 * MCP handler for listing projects.
 *
 * `internal*` only, actor injected by the gateway via `identityArg`. See
 * `_lib/auth.ts → requireCaller` for why this indirection exists at all.
 */
import { mcpCallerValidator } from "convex-mcp-gateway";
import type { Doc } from "../../_generated/dataModel";
import { internalQuery } from "../../_generated/server";
import { requireCaller } from "../../_lib/auth";
import { projectsForUser } from "../../cms/projects";

/**
 * Projects a row down to the fields an agent actually reasons about. The full
 * row also carries frontmatter schemas, retention settings, provider config and
 * the deploy hook URL, none of which belong in a context window. Shared by the
 * `wryte_projects_list` tool and the `wryte://projects` resource.
 */
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
