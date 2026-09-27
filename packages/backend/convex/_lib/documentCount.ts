import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";

export async function adjustDocumentCount(
  ctx: { db: MutationCtx["db"] },
  projectId: Id<"projects">,
  delta: number,
): Promise<void> {
  const project = await ctx.db.get(projectId);
  if (!project) return;
  const current = project.documentCount ?? 0;
  await ctx.db.patch(projectId, {
    documentCount: Math.max(0, current + delta),
  });
}
