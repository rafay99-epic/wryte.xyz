"use client";

import { api } from "@wryte/backend/_generated/api";
import type { Id } from "@wryte/backend/_generated/dataModel";
import { relativeTime } from "@wryte/logic/lib/relative-time";
import { cn } from "@wryte/logic/lib/utils";
import { Button } from "@wryte/ui/button";
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@wryte/ui/sheet";
import { useQuery } from "convex/react";
import { Loader2, RotateCcw } from "lucide-react";
import { Fragment, useMemo } from "react";
import { type DiffRow, diffLines, diffStats, foldUnchanged } from "../lib/diff";

type PublishDiffSheetProps = {
  historyId: Id<"publish_history"> | null;
  /** The selected entry is the latest publish — offer no Restore for it. */
  isLatest: boolean;
  onOpenChange: (open: boolean) => void;
  onRollback: (historyId: Id<"publish_history">) => void;
  rollingBack: boolean;
};

/** Pretty-print a frontmatter JSON string for line-diffing; raw on failure. */
function frontmatterLines(raw: string | undefined): string {
  if (!raw) return "";
  try {
    return JSON.stringify(JSON.parse(raw), null, 2);
  } catch {
    return raw;
  }
}

function DiffBlock({ rows }: { rows: DiffRow[] }) {
  return (
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
                row.line.type === "same" && "text-muted-foreground/80",
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
  );
}

/**
 * What one publish changed compared to the publish before it: green lines
 * were added by this publish, red lines removed. First publish diffs
 * against empty ("everything added"). Frontmatter changes render as their
 * own small block above the body diff.
 */
export function PublishDiffSheet({
  historyId,
  isLatest,
  onOpenChange,
  onRollback,
  rollingBack,
}: PublishDiffSheetProps) {
  const diff = useQuery(
    api.cms.documents.getPublishDiff,
    historyId ? { historyId } : "skip",
  );

  const bodyRows = useMemo(() => {
    if (!diff) return [];
    return foldUnchanged(
      diffLines(diff.previous?.content ?? "", diff.current.content),
    );
  }, [diff]);

  const frontmatterRows = useMemo(() => {
    if (!diff) return [];
    const before = frontmatterLines(diff.previous?.frontmatter);
    const after = frontmatterLines(diff.current.frontmatter);
    if (before === after) return [];
    return foldUnchanged(diffLines(before, after));
  }, [diff]);

  const stats = useMemo(
    () =>
      diffStats(bodyRows.flatMap((r) => (r.kind === "line" ? [r.line] : []))),
    [bodyRows],
  );

  const unchanged =
    diff != null &&
    stats.added === 0 &&
    stats.removed === 0 &&
    frontmatterRows.length === 0;

  return (
    <Sheet open={historyId !== null} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Publish diff</SheetTitle>
          <SheetDescription>
            {diff
              ? diff.previous
                ? `What this publish changed vs the previous one (${relativeTime(diff.current.createdAt)}).`
                : `First retained publish (${relativeTime(diff.current.createdAt)}) — everything shown was added. Older publishes may have been pruned.`
              : "Loading publish snapshots…"}
          </SheetDescription>
        </SheetHeader>

        <SheetBody>
          {diff === undefined ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          ) : diff === null ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Snapshot content is not available for this publish.
            </p>
          ) : unchanged ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              This publish is identical to the previous one.
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
                lines in this publish
              </p>
              {frontmatterRows.length > 0 && (
                <div className="mb-4">
                  <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground/60">
                    Frontmatter
                  </p>
                  <DiffBlock rows={frontmatterRows} />
                </div>
              )}
              <DiffBlock rows={bodyRows} />
            </>
          )}
        </SheetBody>

        <SheetFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          {diff && historyId && !isLatest && (
            <Button
              onClick={() => onRollback(historyId)}
              disabled={rollingBack}
              className="gap-1.5"
            >
              {rollingBack ? (
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
