"use client";

import {
  AlertTriangle,
  Check,
  Cloud,
  FileText,
  Loader2,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
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

export type BulkDeleteMode = "local" | "github" | "both";

export type BulkDeleteCounts = {
  /** How many selected docs live in Wryte and can be removed here. */
  local: number;
  /** How many selected items have a GitHub file we can remove there. */
  github: number;
};

export type BulkDeletePhase = "confirm" | "progress" | "complete";

export type BulkDeleteBatch = {
  total: number;
  succeeded: number;
  failed: number;
  errors?: Array<{ label: string; message: string }>;
};

type BulkDeleteDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** What the user is allowed to delete and how many of each. */
  counts: BulkDeleteCounts;
  /** Drives which phase the dialog renders. */
  phase: BulkDeletePhase;
  /** Live batch progress (used during `progress` and `complete` phases). */
  batch: BulkDeleteBatch | null | undefined;
  /** Fires when the user picks a mode and clicks the primary action. */
  onConfirm: (mode: BulkDeleteMode) => void | Promise<void>;
  /** Fires when the user dismisses the completion summary. */
  onDone: () => void;
  /** Set while the start-action is in flight (between confirm click and batch creation). */
  isStarting: boolean;
};

/**
 * Three-phase dialog for bulk deletes:
 *
 *   1. **confirm** — mode picker. User reads the consequences and picks
 *      one of three scopes (Wryte only / GitHub only / Both).
 *   2. **progress** — live progress bar driven by the parent's reactive
 *      `delete_batches` query. The dialog refuses to close during this
 *      phase so the user can't accidentally walk away from a destructive
 *      operation mid-flight.
 *   3. **complete** — succeeded/failed summary with the first few errors
 *      if any. Closes only when the user clicks "Done".
 *
 * Copy is intentionally non-technical: "Remove from Wryte only" rather
 * than "Delete local copies" — the destination platform is named so the
 * user doesn't have to remember what "local" means.
 */
export function BulkDeleteDialog({
  open,
  onOpenChange,
  counts,
  phase,
  batch,
  onConfirm,
  onDone,
  isStarting,
}: BulkDeleteDialogProps) {
  // ── Confirm-phase state ──────────────────────────────────────
  const initialMode: BulkDeleteMode =
    counts.local > 0 && counts.github > 0
      ? "both"
      : counts.local > 0
        ? "local"
        : "github";
  const [mode, setMode] = useState<BulkDeleteMode>(initialMode);

  // Reset the picker every time the dialog reopens — the selection
  // composition may have changed between two opens.
  useEffect(() => {
    if (open && phase === "confirm") setMode(initialMode);
  }, [open, phase, initialMode]);

  const totalForMode =
    mode === "local"
      ? counts.local
      : mode === "github"
        ? counts.github
        : Math.max(counts.local, counts.github);

  const handleConfirm = useCallback(() => {
    void onConfirm(mode);
  }, [mode, onConfirm]);

  // ── Block close during progress phase ────────────────────────
  // The Convex jobs keep running regardless of UI state, but closing
  // mid-delete would strand the user without a finished/failed summary.
  const handleOpenChange = useCallback(
    (next: boolean) => {
      if (!next && phase === "progress") return;
      onOpenChange(next);
    },
    [phase, onOpenChange],
  );

  // ── Derived progress state ───────────────────────────────────
  const done = batch ? batch.succeeded + batch.failed : 0;
  const total = batch ? batch.total : 0;
  const pct = total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0;
  const errors = batch?.errors ?? [];

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent showCloseButton={phase !== "progress"}>
        {phase === "confirm" && (
          <ConfirmPhase
            counts={counts}
            mode={mode}
            onModeChange={setMode}
            onCancel={() => onOpenChange(false)}
            onConfirm={handleConfirm}
            totalForMode={totalForMode}
            isStarting={isStarting}
          />
        )}
        {phase === "progress" && (
          <ProgressPhase
            mode={
              // Inferred from where we left off in confirm — kept stable
              // across the transition by parent.
              mode
            }
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

/* ────────────────────────────────────────────────────────────── */
/*  Phase 1 — confirm                                              */
/* ────────────────────────────────────────────────────────────── */

function ConfirmPhase({
  counts,
  mode,
  onModeChange,
  onCancel,
  onConfirm,
  totalForMode,
  isStarting,
}: {
  counts: BulkDeleteCounts;
  mode: BulkDeleteMode;
  onModeChange: (m: BulkDeleteMode) => void;
  onCancel: () => void;
  onConfirm: () => void;
  totalForMode: number;
  isStarting: boolean;
}) {
  return (
    <>
      <DialogHeader>
        <DialogTitle>Delete selected articles</DialogTitle>
        <DialogDescription>
          Choose where to remove these articles from. Anything you delete here
          can&apos;t be brought back — GitHub commits are permanent.
        </DialogDescription>
      </DialogHeader>

      <div className="flex flex-col gap-2 py-2">
        <DeleteModeOption
          selected={mode === "local"}
          disabled={counts.local === 0}
          onClick={() => onModeChange("local")}
          icon={<FileText className="size-4 text-muted-foreground" />}
          label="Remove from Wryte only"
          description={
            counts.local > 0
              ? `Wipes ${counts.local} ${counts.local === 1 ? "article" : "articles"} from this workspace. The matching files on GitHub are left alone — your live site keeps serving them.`
              : "Nothing to remove from Wryte in this selection."
          }
        />
        <DeleteModeOption
          selected={mode === "github"}
          disabled={counts.github === 0}
          onClick={() => onModeChange("github")}
          icon={<Cloud className="size-4 text-blue-500" />}
          label="Remove from GitHub only"
          description={
            counts.github > 0
              ? `Deletes ${counts.github} ${counts.github === 1 ? "file" : "files"} from your repo. Wryte keeps a working copy so you can re-publish later. Your live site will lose these posts on next deploy.`
              : "Nothing in this selection is synced to GitHub."
          }
        />
        <DeleteModeOption
          selected={mode === "both"}
          disabled={counts.local === 0 && counts.github === 0}
          onClick={() => onModeChange("both")}
          icon={<AlertTriangle className="size-4 text-destructive" />}
          label="Remove everywhere"
          danger
          description="Wipes both the Wryte copies AND the GitHub files. Use this when you're sure the content is gone for good."
        />
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={onCancel} disabled={isStarting}>
          Cancel
        </Button>
        <Button
          variant="destructive"
          onClick={onConfirm}
          disabled={isStarting || totalForMode === 0}
        >
          {isStarting && <Loader2 className="size-4 animate-spin" />}
          {isStarting
            ? "Starting…"
            : `Delete ${totalForMode > 0 ? totalForMode : ""}`}
        </Button>
      </DialogFooter>
    </>
  );
}

/* ────────────────────────────────────────────────────────────── */
/*  Phase 2 — progress                                             */
/* ────────────────────────────────────────────────────────────── */

function ProgressPhase({
  mode,
  done,
  total,
  pct,
  succeeded,
  failed,
}: {
  mode: BulkDeleteMode;
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
          <Loader2 className="size-4 animate-spin text-primary" />
          <DialogTitle>Deleting articles…</DialogTitle>
        </div>
        <DialogDescription>
          {modeDescription(mode)} You can&apos;t close this window until the job
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
          </div>
        </div>
      </div>
    </>
  );
}

/* ────────────────────────────────────────────────────────────── */
/*  Phase 3 — complete                                             */
/* ────────────────────────────────────────────────────────────── */

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
  errors: Array<{ label: string; message: string }>;
  onDone: () => void;
}) {
  const allSucceeded = failed === 0 && succeeded > 0;
  const allFailed = succeeded === 0 && failed > 0;
  const headline = allSucceeded
    ? "Done."
    : allFailed
      ? "All deletions failed."
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
            ? `Removed ${succeeded} of ${total} ${total === 1 ? "article" : "articles"}.`
            : `Removed ${succeeded} of ${total}. ${failed} ${failed === 1 ? "failed" : "failed"}.`}
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
                key={`${e.label}-${e.message}`}
                className="flex flex-col gap-0.5"
              >
                <span className="font-mono text-foreground/80">{e.label}</span>
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

/* ────────────────────────────────────────────────────────────── */
/*  Pieces                                                          */
/* ────────────────────────────────────────────────────────────── */

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

function modeDescription(mode: BulkDeleteMode): string {
  switch (mode) {
    case "local":
      return "Removing articles from Wryte. GitHub files are untouched.";
    case "github":
      return "Removing files from GitHub. Wryte copies are untouched.";
    case "both":
      return "Removing articles from Wryte AND files from GitHub.";
  }
}

function DeleteModeOption({
  selected,
  disabled,
  onClick,
  icon,
  label,
  description,
  danger,
}: {
  selected: boolean;
  disabled: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  description: string;
  danger?: boolean;
}) {
  // Memoize the selected-color so the both/destructive variant uses the
  // right ring instead of the default primary one.
  const selectionRing = useMemo(
    () =>
      danger
        ? "border-destructive/60 bg-destructive/5 ring-1 ring-destructive/40"
        : "border-primary bg-primary/5 ring-1 ring-primary",
    [danger],
  );

  return (
    <div
      role="button"
      aria-disabled={disabled}
      tabIndex={disabled ? -1 : 0}
      onClick={disabled ? undefined : onClick}
      onKeyDown={(e) => {
        if (disabled) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
      className={cn(
        "flex items-start gap-3 rounded-lg border p-3 transition-colors",
        disabled
          ? "cursor-not-allowed border-border/40 opacity-50"
          : "cursor-pointer",
        !disabled && selected
          ? selectionRing
          : !disabled && "border-border hover:bg-muted/50",
      )}
    >
      <div
        className={cn(
          "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border-2",
          selected && !disabled
            ? danger
              ? "border-destructive"
              : "border-primary"
            : "border-muted-foreground/30",
        )}
      >
        {selected && !disabled && (
          <div
            className={cn(
              "size-2 rounded-full",
              danger ? "bg-destructive" : "bg-primary",
            )}
          />
        )}
      </div>
      <div className="flex flex-1 items-start gap-2.5">
        <div className="mt-0.5 shrink-0">{icon}</div>
        <div className="min-w-0">
          <p className="text-sm font-medium">{label}</p>
          <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
            {description}
          </p>
        </div>
      </div>
    </div>
  );
}
