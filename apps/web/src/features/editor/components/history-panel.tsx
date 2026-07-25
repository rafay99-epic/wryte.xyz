"use client";

import { api } from "@wryte/backend/_generated/api";
import type { Id } from "@wryte/backend/_generated/dataModel";
import { relativeTime } from "@wryte/logic/lib/relative-time";
import { useEditorStore } from "@wryte/logic/stores/editor-store";
import { Button } from "@wryte/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@wryte/ui/tabs";
import { useMutation, useQuery } from "convex/react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Camera,
  Clock,
  ExternalLink,
  FileDiff,
  GitCommit,
  History,
  Loader2,
  RotateCcw,
  Save,
  Timer,
  Users,
  X,
} from "lucide-react";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import { PublishDiffSheet } from "./publish-diff-sheet";
import { SnapshotDiffSheet } from "./snapshot-diff-sheet";

type HistoryPanelProps = {
  documentId: string;
  open: boolean;
  onClose: () => void;
};

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

const REASON_META = {
  manual: { label: "Manual save", icon: Save },
  interval: { label: "Auto", icon: Timer },
  restore: { label: "Pre-restore", icon: RotateCcw },
} as const;

/**
 * Version history side panel: automatic content snapshots (with diff &
 * restore) plus the GitHub publish history. Queries are gated on the
 * panel being open.
 */
type HistoryTab = "snapshots" | "publishes";

export function HistoryPanel({ documentId, open, onClose }: HistoryPanelProps) {
  // Both TabsContent panes stay mounted (CSS-hidden) at once, so gate each
  // tab's subscription on which one is actually selected — otherwise both
  // `snapshots.list` and `getPublishHistory` fire the instant the panel
  // opens, even for the pane the user never looks at.
  const [activeTab, setActiveTab] = useState<HistoryTab>("snapshots");

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 20 }}
          transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
          className="absolute right-0 top-0 z-40 flex h-full w-[340px] flex-col border-l border-border/50 bg-background shadow-lg"
        >
          <div className="flex h-12 shrink-0 items-center justify-between border-b border-border/50 px-4">
            <div className="flex items-center gap-2">
              <History className="size-4 text-muted-foreground" />
              <span className="text-sm font-semibold">History</span>
            </div>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={onClose}
              className="text-muted-foreground"
            >
              <X className="size-4" />
            </Button>
          </div>

          <Tabs
            value={activeTab}
            onValueChange={(value) => setActiveTab(value as HistoryTab)}
            className="flex min-h-0 flex-1 flex-col"
          >
            <div className="shrink-0 px-3 pt-3">
              <TabsList className="w-full">
                <TabsTrigger value="snapshots">Snapshots</TabsTrigger>
                <TabsTrigger value="publishes">Publishes</TabsTrigger>
              </TabsList>
            </div>

            <TabsContent
              value="snapshots"
              className="min-h-0 flex-1 overflow-y-auto slim-scrollbar p-3"
            >
              <SnapshotList
                documentId={documentId}
                active={activeTab === "snapshots"}
              />
            </TabsContent>

            <TabsContent
              value="publishes"
              className="min-h-0 flex-1 overflow-y-auto slim-scrollbar p-3"
            >
              <PublishList
                documentId={documentId}
                active={activeTab === "publishes"}
              />
            </TabsContent>
          </Tabs>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ── Snapshots tab ───────────────────────────────────────────────────── */

function SnapshotList({
  documentId,
  active,
}: {
  documentId: string;
  active: boolean;
}) {
  const snapshots = useQuery(
    api.cms.snapshots.list,
    active ? { documentId: documentId as Id<"documents"> } : "skip",
  );
  const restoreSnapshot = useMutation(api.cms.snapshots.restore);
  const [diffSnapshotId, setDiffSnapshotId] =
    useState<Id<"document_snapshots"> | null>(null);
  const [restoringId, setRestoringId] = useState<string | null>(null);

  const handleRestore = useCallback(
    async (snapshotId: Id<"document_snapshots">) => {
      setRestoringId(snapshotId);
      try {
        const result = await restoreSnapshot({ snapshotId });
        // Clear dirty so the reactive subscription delivers the restored
        // content into the editor via the sync effect.
        useEditorStore.getState().markSaved();
        setDiffSnapshotId(null);
        toast.success("Snapshot restored", {
          description: `Back to the version from ${relativeTime(result.restoredFrom)}. A pre-restore snapshot of your previous draft was kept.`,
        });
      } catch (err) {
        toast.error("Restore failed", {
          description:
            err instanceof Error ? err.message : "An unknown error occurred.",
        });
      } finally {
        setRestoringId(null);
      }
    },
    [restoreSnapshot],
  );

  if (snapshots === undefined) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-16 animate-pulse rounded-lg bg-muted/40" />
        ))}
      </div>
    );
  }

  if (snapshots.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="mb-3 flex size-10 items-center justify-center rounded-full bg-muted/50">
          <Camera className="size-4 text-muted-foreground/50" />
        </div>
        <p className="text-sm font-medium text-muted-foreground/70">
          No snapshots yet
        </p>
        <p className="mt-1 text-xs text-muted-foreground/50">
          Snapshots are captured on manual saves (Ctrl+S) and every few minutes
          while you write.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-2">
        {snapshots.map((snapshot, index) => {
          const meta = REASON_META[snapshot.reason];
          const ReasonIcon = meta.icon;
          return (
            <motion.div
              key={snapshot._id}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.03, duration: 0.2 }}
              className="group rounded-lg border border-border/50 bg-card/50 p-3 transition-colors hover:bg-muted/30"
            >
              <div className="flex items-center gap-2">
                <span className="flex items-center gap-1 rounded-full bg-muted px-1.5 py-px text-[10px] font-medium text-muted-foreground">
                  <ReasonIcon className="size-2.5" />
                  {meta.label}
                </span>
                <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground/60">
                  <Clock className="size-2.5" />
                  {relativeTime(snapshot.createdAt)}
                </span>
                <span className="ml-auto text-[10px] tabular-nums text-muted-foreground/50">
                  {snapshot.wordCount.toLocaleString()} words
                </span>
              </div>

              <div className="mt-2 flex items-center gap-1.5 opacity-0 transition-opacity group-hover:opacity-100">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 gap-1 px-2 text-[11px]"
                  onClick={() => setDiffSnapshotId(snapshot._id)}
                >
                  <GitCommit className="size-3" />
                  Diff
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 gap-1 px-2 text-[11px]"
                  onClick={() => void handleRestore(snapshot._id)}
                  disabled={restoringId === snapshot._id}
                >
                  {restoringId === snapshot._id ? (
                    <Loader2 className="size-3 animate-spin" />
                  ) : (
                    <RotateCcw className="size-3" />
                  )}
                  Restore
                </Button>
              </div>

              <p className="mt-1.5 hidden text-[10px] text-muted-foreground/40 group-hover:block">
                {formatDate(snapshot.createdAt)}
              </p>
            </motion.div>
          );
        })}
      </div>

      <SnapshotDiffSheet
        snapshotId={diffSnapshotId}
        onOpenChange={(open) => {
          if (!open) setDiffSnapshotId(null);
        }}
        onRestore={(id) => void handleRestore(id)}
        restoring={restoringId !== null}
      />
    </>
  );
}

/* ── Publishes tab ───────────────────────────────────────────────────── */

function PublishList({
  documentId,
  active,
}: {
  documentId: string;
  active: boolean;
}) {
  const history = useQuery(
    api.cms.documents.getPublishHistory,
    active ? { documentId: documentId as Id<"documents"> } : "skip",
  );
  const rollback = useMutation(api.cms.documents.rollbackToVersion);
  const [rollingBack, setRollingBack] = useState<string | null>(null);
  const [diffHistoryId, setDiffHistoryId] =
    useState<Id<"publish_history"> | null>(null);

  const handleRollback = useCallback(
    async (historyId: string) => {
      setRollingBack(historyId);
      try {
        const result = await rollback({
          documentId: documentId as Id<"documents">,
          historyId: historyId as Id<"publish_history">,
        });
        useEditorStore.getState().markSaved();
        setDiffHistoryId(null);
        toast.success("Rolled back successfully", {
          description: `Restored to version from ${relativeTime(result.restoredFrom)}`,
        });
      } catch (err) {
        toast.error("Rollback failed", {
          description:
            err instanceof Error ? err.message : "An unknown error occurred.",
        });
      } finally {
        setRollingBack(null);
      }
    },
    [documentId, rollback],
  );

  if (history === undefined) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-20 animate-pulse rounded-lg bg-muted/40" />
        ))}
      </div>
    );
  }

  if (history.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="mb-3 flex size-10 items-center justify-center rounded-full bg-muted/50">
          <GitCommit className="size-4 text-muted-foreground/50" />
        </div>
        <p className="text-sm font-medium text-muted-foreground/70">
          No publish history
        </p>
        <p className="mt-1 text-xs text-muted-foreground/50">
          Publish your article to start tracking versions.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {history.map((entry, index) => (
        <motion.div
          key={entry._id}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.03, duration: 0.2 }}
          className="group rounded-lg border border-border/50 bg-card/50 p-3 transition-colors hover:bg-muted/30"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium text-foreground">
                {entry.commitMessage}
              </p>
              <div className="mt-1 flex items-center gap-2 text-[10px] text-muted-foreground/60">
                <span className="flex items-center gap-0.5">
                  <Clock className="size-2.5" />
                  {relativeTime(entry.createdAt)}
                </span>
                {entry.isBulk && (
                  <span className="flex items-center gap-0.5 rounded-full bg-purple-500/10 px-1.5 py-px text-purple-500">
                    <Users className="size-2.5" />
                    Bulk
                  </span>
                )}
                {index === 0 && (
                  <span className="rounded-full bg-emerald-500/10 px-1.5 py-px text-emerald-500">
                    Latest
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="mt-2 flex items-center gap-2">
            <code className="flex items-center gap-1 rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
              <GitCommit className="size-2.5" />
              {entry.commitSha.slice(0, 7)}
            </code>
            <span className="truncate font-mono text-[10px] text-muted-foreground/50">
              {entry.githubPath}
            </span>
          </div>

          <div className="mt-2 flex items-center gap-1.5 opacity-0 transition-opacity group-hover:opacity-100">
            <Button
              variant="ghost"
              size="sm"
              className="h-6 gap-1 px-2 text-[11px]"
              onClick={() => setDiffHistoryId(entry._id)}
            >
              <FileDiff className="size-3" />
              Diff
            </Button>
            {index > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 gap-1 px-2 text-[11px]"
                onClick={() => void handleRollback(entry._id)}
                disabled={rollingBack === entry._id}
              >
                {rollingBack === entry._id ? (
                  <Loader2 className="size-3 animate-spin" />
                ) : (
                  <RotateCcw className="size-3" />
                )}
                Restore
              </Button>
            )}
            {entry.commitUrl && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 gap-1 px-2 text-[11px]"
                onClick={() => window.open(entry.commitUrl, "_blank")}
              >
                <ExternalLink className="size-3" />
                View commit
              </Button>
            )}
          </div>

          <p className="mt-1.5 hidden text-[10px] text-muted-foreground/40 group-hover:block">
            {formatDate(entry.createdAt)}
          </p>
        </motion.div>
      ))}

      <PublishDiffSheet
        historyId={diffHistoryId}
        isLatest={diffHistoryId !== null && history[0]?._id === diffHistoryId}
        onOpenChange={(open) => {
          if (!open) setDiffHistoryId(null);
        }}
        onRollback={(id) => void handleRollback(id)}
        rollingBack={rollingBack !== null}
      />
    </div>
  );
}
