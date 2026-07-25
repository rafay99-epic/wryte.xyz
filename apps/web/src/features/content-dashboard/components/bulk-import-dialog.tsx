"use client";

import type { Id } from "@wryte/backend/_generated/dataModel";
import { cn } from "@wryte/logic/lib/utils";
import { Button } from "@wryte/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@wryte/ui/dialog";
import {
  AlertTriangle,
  ArrowRight,
  Check,
  Download,
  Loader2,
  X,
} from "lucide-react";

export type BulkImportPhase = "progress" | "complete";

export type BulkImportBatch = {
  total: number;
  succeeded: number;
  failed: number;
  errors?: Array<{ filePath: string; message: string }>;
};

export type BulkImportResultLite = {
  counts: {
    new: number;
    fastForward: number;
    unchanged: number;
    conflict: number;
    missing: number;
  };
  conflicts: Array<{
    path: string;
    documentId: Id<"documents">;
    conflictId: Id<"sync_conflicts">;
  }>;
  missing: string[];
};

type BulkImportDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Drives which phase the dialog renders. */
  phase: BulkImportPhase;
  /** Live batch progress driven by the parent's reactive query. */
  batch: BulkImportBatch | null | undefined;
  /**
   * Server-returned classification summary. Present once `startBulkImport`
   * resolves; rendered on the completion screen alongside any batch errors.
   * Null while a fresh batch is still spinning up.
   */
  result?: BulkImportResultLite | null;
  /** Fires when the user dismisses the completion summary. */
  onDone: () => void;
  /**
   * Navigate to the conflict resolution UI. Called with the first
   * unresolved conflict's id when the user clicks "Resolve conflicts".
   */
  onResolveConflicts?: ((conflictId: Id<"sync_conflicts">) => void) | undefined;
};

/**
 * Three-state dialog for bulk imports / syncs:
 *
 *   1. **Progress** — visible while the workpool drains `new` /
 *      `fastForward` jobs. Driven by the reactive `batch` row.
 *   2. **Complete** — terminal state. Shows the action's classification
 *      summary (new / fast-forwarded / unchanged / conflicts / missing)
 *      plus any per-job failures from `batch.errors`.
 *
 * The classification summary is what makes a re-sync feel honest:
 * "94 unchanged, 2 imported, 1 conflict" is the user-readable
 * counterpart of "we didn't waste workpool jobs on the 94 unchanged".
 */
export function BulkImportDialog({
  open,
  onOpenChange,
  phase,
  batch,
  result,
  onDone,
  onResolveConflicts,
}: BulkImportDialogProps) {
  const handleOpenChange = (next: boolean) => {
    if (!next && phase === "progress") return;
    onOpenChange(next);
  };

  const done = batch ? batch.succeeded + batch.failed : 0;
  const total = batch ? batch.total : 0;
  const pct = total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0;
  const errors = batch?.errors ?? [];

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent showCloseButton={phase !== "progress"}>
        {phase === "progress" && (
          <ProgressPhase
            done={done}
            total={total}
            pct={pct}
            succeeded={batch?.succeeded ?? 0}
            failed={batch?.failed ?? 0}
            isChecking={!batch}
          />
        )}
        {phase === "complete" && (
          <CompletePhase
            result={result ?? null}
            batchSucceeded={batch?.succeeded ?? 0}
            batchFailed={batch?.failed ?? 0}
            errors={errors}
            onDone={onDone}
            onResolveConflicts={onResolveConflicts}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function ProgressPhase({
  done,
  total,
  pct,
  succeeded,
  failed,
  isChecking,
}: {
  done: number;
  total: number;
  pct: number;
  succeeded: number;
  failed: number;
  /** True before any batch exists — server is still classifying files. */
  isChecking: boolean;
}) {
  return (
    <>
      <DialogHeader>
        <div className="flex items-center gap-2">
          <Download className="size-4 text-primary" />
          <DialogTitle>
            {isChecking ? "Checking for changes…" : "Syncing from GitHub…"}
          </DialogTitle>
        </div>
        <DialogDescription>
          {isChecking
            ? "Comparing GitHub against your version. This usually takes a second."
            : "Importing files that changed. Closing the window is disabled until the sync finishes."}
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-4 py-2">
        {isChecking ? (
          <div className="flex items-center justify-center gap-2 py-6 text-xs text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Comparing files…
          </div>
        ) : (
          <>
            <ProgressBar pct={pct} />
            <div className="flex items-center justify-between text-xs">
              <span className="font-mono tabular-nums text-muted-foreground">
                {done}/{total}{" "}
                <span className="text-muted-foreground/50">({pct}%)</span>
              </span>
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-500">
                  <Check className="size-3" />
                  {succeeded}
                </span>
                {failed > 0 && (
                  <span className="flex items-center gap-1.5 text-destructive">
                    <X className="size-3" />
                    {failed}
                  </span>
                )}
                {done < total && (
                  <Loader2 className="size-3 animate-spin text-muted-foreground" />
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}

function CompletePhase({
  result,
  batchSucceeded,
  batchFailed,
  errors,
  onDone,
  onResolveConflicts,
}: {
  result: BulkImportResultLite | null;
  batchSucceeded: number;
  batchFailed: number;
  errors: Array<{ filePath: string; message: string }>;
  onDone: () => void;
  onResolveConflicts?: ((conflictId: Id<"sync_conflicts">) => void) | undefined;
}) {
  const counts = result?.counts;
  const conflicts = result?.conflicts ?? [];
  const missing = result?.missing ?? [];
  const totalImported = batchSucceeded;
  const totalChanged = (counts?.new ?? 0) + (counts?.fastForward ?? 0);
  const totalConflicts = counts?.conflict ?? conflicts.length;
  const totalMissing = counts?.missing ?? missing.length;
  const totalUnchanged = counts?.unchanged ?? 0;

  const hasFailures = batchFailed > 0;
  const allClean =
    !hasFailures &&
    totalConflicts === 0 &&
    totalMissing === 0 &&
    totalChanged === 0;

  const headline = hasFailures
    ? "Sync finished with errors"
    : totalConflicts > 0
      ? "Conflicts need your attention"
      : totalChanged > 0
        ? "Sync complete"
        : totalMissing > 0
          ? "Some files no longer on GitHub"
          : "Everything is up to date";

  const description = (() => {
    if (totalChanged > 0) {
      return `Imported ${totalImported} of ${totalChanged} ${totalChanged === 1 ? "changed file" : "changed files"}.`;
    }
    if (totalConflicts > 0) {
      return `Resolve ${totalConflicts === 1 ? "this conflict" : "these conflicts"} before the next sync.`;
    }
    if (totalMissing > 0) {
      return `${totalMissing} ${totalMissing === 1 ? "file is" : "files are"} in Wryte but no longer in the repo.`;
    }
    return "Nothing changed since the last sync.";
  })();

  return (
    <>
      <DialogHeader>
        <div className="flex items-center gap-2">
          {allClean ? (
            <Check className="size-4 text-emerald-600 dark:text-emerald-500" />
          ) : (
            <AlertTriangle
              className={cn(
                "size-4",
                hasFailures || totalConflicts > 0
                  ? "text-amber-500"
                  : "text-muted-foreground",
              )}
            />
          )}
          <DialogTitle>{headline}</DialogTitle>
        </div>
        <DialogDescription>{description}</DialogDescription>
      </DialogHeader>

      {counts && (
        <div className="grid grid-cols-5 gap-1.5">
          <SummaryCell
            label="New"
            value={counts.new}
            tone={counts.new > 0 ? "primary" : "muted"}
          />
          <SummaryCell
            label="Updated"
            value={counts.fastForward}
            tone={counts.fastForward > 0 ? "primary" : "muted"}
          />
          <SummaryCell label="Unchanged" value={totalUnchanged} tone="muted" />
          <SummaryCell
            label="Conflicts"
            value={totalConflicts}
            tone={totalConflicts > 0 ? "warning" : "muted"}
          />
          <SummaryCell
            label="Missing"
            value={totalMissing}
            tone={totalMissing > 0 ? "warning" : "muted"}
          />
        </div>
      )}

      {totalConflicts > 0 && conflicts.length > 0 && onResolveConflicts && (
        <button
          type="button"
          onClick={() => {
            const first = conflicts[0];
            if (first) onResolveConflicts(first.conflictId);
          }}
          className="flex items-center justify-between gap-3 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2.5 text-left text-xs transition-colors hover:bg-amber-500/10"
        >
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="font-medium text-amber-700 dark:text-amber-400">
              {totalConflicts}{" "}
              {totalConflicts === 1 ? "conflict needs" : "conflicts need"} your
              attention
            </span>
            <span className="truncate text-muted-foreground">
              Both GitHub and your version changed since the last sync.
            </span>
          </div>
          <ArrowRight className="size-3.5 shrink-0 text-amber-700 dark:text-amber-400" />
        </button>
      )}

      {missing.length > 0 && (
        <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-xs">
          <p className="mb-1 font-medium text-amber-700 dark:text-amber-400">
            No longer in the repo
          </p>
          <ul className="space-y-1 text-muted-foreground">
            {missing.slice(0, 5).map((p) => (
              <li key={p} className="font-mono">
                {p}
              </li>
            ))}
            {missing.length > 5 && (
              <li className="italic">
                …and {missing.length - 5}{" "}
                {missing.length - 5 === 1 ? "other" : "others"}
              </li>
            )}
          </ul>
        </div>
      )}

      {errors.length > 0 && (
        <div className="max-h-48 overflow-y-auto rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-xs">
          <p className="mb-2 font-medium text-destructive">
            Failures{errors.length >= 20 ? " (showing first 20)" : ""}
          </p>
          <ul className="space-y-1.5">
            {errors.map((e) => (
              <li
                key={`${e.filePath}-${e.message}`}
                className="flex flex-col gap-0.5"
              >
                <span className="font-mono text-foreground/80">
                  {e.filePath}
                </span>
                <span className="text-muted-foreground">{e.message}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <DialogFooter>
        <Button onClick={onDone}>Done</Button>
      </DialogFooter>
    </>
  );
}

function SummaryCell({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "primary" | "warning" | "muted";
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-0.5 rounded-md border bg-card/50 px-1.5 py-2 text-center",
        tone === "primary" && "border-primary/30",
        tone === "warning" && "border-amber-500/30",
        tone === "muted" && "border-border/60",
      )}
    >
      <span
        className={cn(
          "text-lg font-semibold tabular-nums leading-none",
          tone === "primary" && "text-primary",
          tone === "warning" && "text-amber-700 dark:text-amber-400",
          tone === "muted" && "text-muted-foreground",
        )}
      >
        {value}
      </span>
      <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground/80">
        {label}
      </span>
    </div>
  );
}

function ProgressBar({ pct }: { pct: number }) {
  return (
    <div
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
      className="h-2 w-full overflow-hidden rounded-full bg-muted"
    >
      <div
        className="h-full rounded-full bg-primary transition-[width] duration-300 ease-out"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
