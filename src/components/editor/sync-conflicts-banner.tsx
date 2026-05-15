"use client";

import { AlertTriangle, ArrowRight } from "lucide-react";
import Link from "next/link";
import { useSyncConflicts } from "@/hooks/use-sync-conflicts";
import type { Id } from "../../../convex/_generated/dataModel";

/**
 * Persistent banner shown above the project dashboard when there are
 * unresolved sync conflicts. Hidden while loading and when the list
 * is empty — the banner is meant to be a quiet companion, not a
 * spinner.
 *
 * Clicking the banner deep-links to the first unresolved conflict.
 * The conflict route itself handles auth + ownership checks, so the
 * banner is fine as a regular anchor (server-side validation guards
 * against tampering with the URL).
 */
export function SyncConflictsBanner({
  projectId,
}: {
  projectId: Id<"projects">;
}) {
  const conflicts = useSyncConflicts(projectId);
  if (!conflicts || conflicts.length === 0) return null;

  const first = conflicts[0];
  if (!first) return null;

  const count = conflicts.length;
  return (
    <Link
      href={`/projects/${projectId}/conflicts/${first._id}`}
      className="mb-4 flex items-center justify-between rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-sm hover:bg-amber-500/10 transition-colors"
    >
      <div className="flex items-center gap-3">
        <AlertTriangle className="size-4 text-amber-700 dark:text-amber-400" />
        <div className="flex flex-col gap-0.5">
          <span className="font-medium text-amber-700 dark:text-amber-400">
            {count} {count === 1 ? "sync conflict" : "sync conflicts"} pending
          </span>
          <span className="text-xs text-muted-foreground">
            Both GitHub and your version changed for{" "}
            {count === 1 ? "this file" : "these files"} since the last sync.
            Resolve before re-syncing.
          </span>
        </div>
      </div>
      <ArrowRight className="size-4 text-amber-700 dark:text-amber-400" />
    </Link>
  );
}
