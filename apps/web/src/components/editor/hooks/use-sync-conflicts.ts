import { api } from "@wryte/backend/_generated/api";
import type { Id } from "@wryte/backend/_generated/dataModel";
import { useQuery } from "convex/react";

export type SyncConflictSummary = {
  _id: Id<"sync_conflicts">;
  documentId: Id<"documents">;
  githubPath: string;
  detectedAt: number;
};

export function useSyncConflicts(
  projectId: Id<"projects"> | null | undefined,
): SyncConflictSummary[] | undefined {
  const conflicts = useQuery(
    api.cms.conflicts.listForProject,
    projectId ? { projectId } : "skip",
  );
  return conflicts as SyncConflictSummary[] | undefined;
}
