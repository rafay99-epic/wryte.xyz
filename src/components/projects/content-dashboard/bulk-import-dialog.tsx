"use client";

import { AlertTriangle, Check, Download, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export type BulkImportPhase = "progress" | "complete";

export interface BulkImportBatch {
  total: number;
  succeeded: number;
  failed: number;
  errors?: Array<{ filePath: string; message: string }>;
}

interface BulkImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Drives which phase the dialog renders. */
  phase: BulkImportPhase;
  /** Live batch progress driven by the parent's reactive query. */
  batch: BulkImportBatch | null | undefined;
  /** Fires when the user dismisses the completion summary. */
  onDone: () => void;
}

/**
 * Two-phase dialog for bulk imports. Unlike delete, there's no confirm
 * phase — importing is additive (won't overwrite local edits because the
 * import mutation dedups on `githubPath`), so the user's click on the
 * toolbar's "Import" button is itself the confirmation. The dialog
 * opens straight into the progress view and stays open until the batch
 * finishes; closing is blocked while jobs are in flight so the user
 * can't lose track of an active import.
 */
export function BulkImportDialog({
  open,
  onOpenChange,
  phase,
  batch,
  onDone,
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
          />
        )}
        {phase === "complete" && (
          <CompletePhase
            total={total}
            succeeded={batch?.succeeded ?? 0}
            failed={batch?.failed ?? 0}
            errors={errors}
            onDone={onDone}
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
}: {
  done: number;
  total: number;
  pct: number;
  succeeded: number;
  failed: number;
}) {
  return (
    <>
      <DialogHeader>
        <div className="flex items-center gap-2">
          <Download className="size-4 text-primary" />
          <DialogTitle>Importing from GitHub…</DialogTitle>
        </div>
        <DialogDescription>
          Fetching markdown from your repo and storing it in Wryte. You can
          watch progress here — closing the window is disabled until the import
          finishes.
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-4 py-2">
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
      </div>
    </>
  );
}

function CompletePhase({
  total,
  succeeded,
  failed,
  errors,
  onDone,
}: {
  total: number;
  succeeded: number;
  failed: number;
  errors: Array<{ filePath: string; message: string }>;
  onDone: () => void;
}) {
  const allSucceeded = failed === 0 && succeeded > 0;
  const allFailed = succeeded === 0 && failed > 0;
  const headline = allSucceeded
    ? "Import complete."
    : allFailed
      ? "Import failed."
      : "Finished with some failures.";

  return (
    <>
      <DialogHeader>
        <div className="flex items-center gap-2">
          {allSucceeded ? (
            <Check className="size-4 text-emerald-600 dark:text-emerald-500" />
          ) : (
            <AlertTriangle
              className={cn(
                "size-4",
                allFailed ? "text-destructive" : "text-amber-500",
              )}
            />
          )}
          <DialogTitle>{headline}</DialogTitle>
        </div>
        <DialogDescription>
          {allSucceeded
            ? `Imported ${succeeded} of ${total} ${total === 1 ? "file" : "files"}.`
            : `Imported ${succeeded} of ${total}. ${failed} ${failed === 1 ? "failed" : "failed"}.`}
        </DialogDescription>
      </DialogHeader>

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
