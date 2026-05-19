import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";

export type SyncConflictSummary = {
  _id: Id<"sync_conflicts">;
  documentId: Id<"documents">;
  githubPath: string;
  detectedAt: number;
};

/**
 * Subscribes to the unresolved sync conflicts for a project. Powers the
 * persistent banner on the project dashboard and the "Resolve N
 * conflicts" CTA in the bulk-import dialog.
 *
 * Returns `undefined` while the query is loading so callers can render
 * a skeleton; an empty array once loaded with no conflicts.
 */
export function useSyncConflicts(
  projectId: Id<"projects"> | null | undefined,
): SyncConflictSummary[] | undefined {
  const conflicts = useQuery(
    api.cms.conflicts.listForProject,
    projectId ? { projectId } : "skip",
  );
  return conflicts as SyncConflictSummary[] | undefined;
}
