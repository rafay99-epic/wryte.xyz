"use client";

import type { Id } from "@wryte/backend/_generated/dataModel";
import { cn } from "@wryte/logic/lib/utils";
import { buttonVariants } from "@wryte/ui/button";
import { AlertTriangle, ArrowRight } from "lucide-react";
import Link from "next/link";

type ConflictLockViewProps = {
  projectId: Id<"projects">;
  conflictId: Id<"sync_conflicts">;
  githubPath: string;
  title: string;
};

/**
 * Replaces the editor surface when a document has an unresolved sync
 * conflict. Editing is blocked both client-side (this view) and
 * server-side (the `documents.update` mutation refuses to write while
 * an open conflict exists), so background autosave from a stale tab
 * can't sneak edits past the lock.
 */
export function ConflictLockView({
  projectId,
  conflictId,
  githubPath,
  title,
}: ConflictLockViewProps) {
  return (
    <div className="flex h-full flex-col items-center justify-center p-6">
      <div className="flex w-full max-w-md flex-col gap-4 rounded-2xl border border-amber-500/30 bg-amber-500/5 p-6">
        <div className="flex items-center gap-2">
          <AlertTriangle className="size-5 text-amber-500" />
          <h2 className="text-base font-semibold tracking-tight">
            Sync conflict pending
          </h2>
        </div>
        <p className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground">{title}</span> can't be
          edited until the sync conflict is resolved. Both GitHub and your
          version changed since the last sync.
        </p>
        <p className="text-xs text-muted-foreground/80">
          <span className="font-mono">{githubPath}</span>
        </p>
        <Link
          href={`/projects/${projectId}/conflicts/${conflictId}`}
          className={cn(
            buttonVariants({ size: "sm" }),
            "w-full justify-center gap-2",
          )}
        >
          Resolve conflict
          <ArrowRight className="size-3.5" />
        </Link>
      </div>
    </div>
  );
}
