import type { Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { mdxComponentNames } from "../_lib/animationTransform";

export type DraftReport = {
  unknownComponents: string[];
  mdxError: string | null;
};

export async function draftReport(
  ctx: QueryCtx,
  projectId: Id<"projects">,
  body: string,
): Promise<DraftReport> {
  const project = await ctx.db.get(projectId);
  if (project?.contentFormat !== "mdx") {
    return { unknownComponents: [], mdxError: null };
  }

  const scan = mdxComponentNames(body);
  if ("error" in scan) return { unknownComponents: [], mdxError: scan.error };

  const unknownComponents: string[] = [];
  for (const name of scan.names) {
    const known = await ctx.db
      .query("animation_names")
      .withIndex("by_project_and_name", (q) =>
        q.eq("projectId", projectId).eq("name", name),
      )
      .unique();
    if (!known) unknownComponents.push(name);
  }
  return { unknownComponents, mdxError: null };
}
