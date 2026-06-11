"use client";

import { useQuery } from "convex/react";
import { Loader2, RotateCcw } from "lucide-react";
import { Fragment, useMemo } from "react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { relativeTime } from "@/lib/relative-time";
import { cn } from "@/lib/utils";
import { useEditorStore } from "@/stores/editor-store";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { type DiffLine, diffLines, diffStats } from "../lib/diff";

type SnapshotDiffSheetProps = {
  snapshotId: Id<"document_snapshots"> | null;
  onOpenChange: (open: boolean) => void;
  onRestore: (snapshotId: Id<"document_snapshots">) => void;
  restoring: boolean;
};

/** Collapse runs of unchanged lines longer than this in the diff view. */
const CONTEXT_LINES = 3;

type DiffRow =
  | { kind: "line"; line: DiffLine; key: number }
  | { kind: "fold"; count: number; key: number };

function foldUnchanged(lines: DiffLine[]): DiffRow[] {
  const rows: DiffRow[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i] as DiffLine;
    if (line.type !== "same") {
      rows.push({ kind: "line", line, key: i });
      i++;
      continue;
    }
    let runEnd = i;
    while (
      runEnd < lines.length &&
      (lines[runEnd] as DiffLine).type === "same"
    ) {
      runEnd++;
    }
    const runLength = runEnd - i;
    if (runLength <= CONTEXT_LINES * 2 + 1) {
      for (let k = i; k < runEnd; k++) {
        rows.push({ kind: "line", line: lines[k] as DiffLine, key: k });
      }
    } else {
      const keepStart = i === 0 ? 0 : CONTEXT_LINES;
      const keepEnd = runEnd === lines.length ? 0 : CONTEXT_LINES;
      for (let k = i; k < i + keepStart; k++) {
        rows.push({ kind: "line", line: lines[k] as DiffLine, key: k });
      }
      rows.push({
        kind: "fold",
        count: runLength - keepStart - keepEnd,
        key: i + keepStart,
      });
      for (let k = runEnd - keepEnd; k < runEnd; k++) {
        rows.push({ kind: "line", line: lines[k] as DiffLine, key: k });
      }
    }
    i = runEnd;
  }
  return rows;
}

/**
 * Diff between the current editor content and a snapshot, framed as "what
 * restoring would change": green lines are what the snapshot adds back,
 * red lines are what it removes.
 */
export function SnapshotDiffSheet({
  snapshotId,
  onOpenChange,
  onRestore,
  restoring,
}: SnapshotDiffSheetProps) {
  const snapshot = useQuery(
    api.cms.snapshots.get,
    snapshotId ? { snapshotId } : "skip",
  );
  const content = useEditorStore((s) => s.content);

  const rows = useMemo(() => {
    if (!snapshot) return [];
    return foldUnchanged(diffLines(content, snapshot.content));
  }, [snapshot, content]);

  const stats = useMemo(
    () => diffStats(rows.flatMap((r) => (r.kind === "line" ? [r.line] : []))),
    [rows],
  );

  const unchanged =
    snapshot !== undefined && snapshot !== null
      ? stats.added === 0 && stats.removed === 0
      : false;

  return (
    <Sheet open={snapshotId !== null} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Snapshot diff</SheetTitle>
          <SheetDescription>
            {snapshot
              ? `Compared to your current draft — restoring applies the changes below (from ${relativeTime(snapshot.createdAt)}).`
              : "Loading snapshot…"}
          </SheetDescription>
        </SheetHeader>

        <SheetBody>
          {snapshot === undefined ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          ) : snapshot === null ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Snapshot not found.
            </p>
          ) : unchanged ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              This snapshot is identical to your current draft.
            </p>
          ) : (
            <>
              <p className="mb-3 text-xs tabular-nums text-muted-foreground">
                <span className="font-medium text-emerald-600">
                  +{stats.added}
                </span>{" "}
                <span className="font-medium text-red-500">
                  −{stats.removed}
                </span>{" "}
                lines if restored
              </p>
              <div className="overflow-x-auto rounded-lg border border-border/50 font-mono text-[12px] leading-relaxed">
                {rows.map((row) => (
                  <Fragment key={row.key}>
                    {row.kind === "fold" ? (
                      <div className="border-y border-border/30 bg-muted/30 px-3 py-1 text-[10px] text-muted-foreground/60">
                        ⋯ {row.count} unchanged lines
                      </div>
                    ) : (
                      <div
                        className={cn(
                          "whitespace-pre-wrap break-words px-3",
                          row.line.type === "added" &&
                            "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
                          row.line.type === "removed" &&
                            "bg-red-500/10 text-red-600 dark:text-red-400",
                          row.line.type === "same" &&
                            "text-muted-foreground/80",
                        )}
                      >
                        <span className="mr-2 select-none opacity-60">
                          {row.line.type === "added"
                            ? "+"
                            : row.line.type === "removed"
                              ? "−"
                              : " "}
                        </span>
                        {row.line.text || " "}
                      </div>
                    )}
                  </Fragment>
                ))}
              </div>
            </>
          )}
        </SheetBody>

        <SheetFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          {snapshot && !unchanged && (
            <Button
              onClick={() => onRestore(snapshot._id)}
              disabled={restoring}
              className="gap-1.5"
            >
              {restoring ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <RotateCcw className="size-3.5" />
              )}
              Restore this version
            </Button>
          )}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
