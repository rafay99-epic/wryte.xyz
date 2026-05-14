"use client";

import { useMutation, useQuery } from "convex/react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Clock,
  ExternalLink,
  GitCommit,
  History,
  Loader2,
  RotateCcw,
  Users,
  X,
} from "lucide-react";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useEditorStore } from "@/stores/editor-store";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

type PublishHistoryPanelProps = {
  documentId: string;
  open: boolean;
  onClose: () => void;
};

function relativeTime(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${String(mins)}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${String(hours)}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${String(days)}d ago`;
  return new Date(timestamp).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function PublishHistoryPanel({
  documentId,
  open,
  onClose,
}: PublishHistoryPanelProps) {
  const history = useQuery(
    api.cms.documents.getPublishHistory,
    open ? { documentId: documentId as Id<"documents"> } : "skip",
  );
  const rollback = useMutation(api.cms.documents.rollbackToVersion);
  const [rollingBack, setRollingBack] = useState<string | null>(null);

  const handleRollback = useCallback(
    async (historyId: string) => {
      setRollingBack(historyId);
      try {
        const result = await rollback({
          documentId: documentId as Id<"documents">,
          historyId: historyId as Id<"publish_history">,
        });

        // Update the editor store with restored content
        const store = useEditorStore.getState();
        store.setTitle(result.title);

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
          {/* Header */}
          <div className="flex h-12 shrink-0 items-center justify-between border-b border-border/50 px-4">
            <div className="flex items-center gap-2">
              <History className="size-4 text-muted-foreground" />
              <span className="text-sm font-semibold">Publish History</span>
              {history && (
                <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-muted-foreground">
                  {history.length}
                </span>
              )}
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

          {/* Content */}
          <div className="flex-1 overflow-y-auto slim-scrollbar p-3">
            {history === undefined ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="h-20 animate-pulse rounded-lg bg-muted/40"
                  />
                ))}
              </div>
            ) : history.length === 0 ? (
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
            ) : (
              <div className="space-y-2">
                {history.map((entry, index) => (
                  <motion.div
                    key={entry._id}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.03, duration: 0.2 }}
                    className="group rounded-lg border border-border/50 bg-card/50 p-3 transition-colors hover:bg-muted/30"
                  >
                    {/* Commit info */}
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

                    {/* SHA + path */}
                    <div className="mt-2 flex items-center gap-2">
                      <code className="flex items-center gap-1 rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                        <GitCommit className="size-2.5" />
                        {entry.commitSha.slice(0, 7)}
                      </code>
                      <span className="truncate font-mono text-[10px] text-muted-foreground/50">
                        {entry.githubPath}
                      </span>
                    </div>

                    {/* Actions */}
                    <div className="mt-2 flex items-center gap-1.5 opacity-0 transition-opacity group-hover:opacity-100">
                      {/* Rollback button — don't show for the latest version */}
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

                    {/* Tooltip-style date on hover */}
                    <p className="mt-1.5 hidden text-[10px] text-muted-foreground/40 group-hover:block">
                      {formatDate(entry.createdAt)}
                    </p>
                  </motion.div>
                ))}
              </div>
            )}
          </div>

          {/* Summary footer */}
          {history && history.length > 0 && (
            <div className="shrink-0 border-t border-border/50 px-4 py-2.5">
              <p className="text-[11px] text-muted-foreground/60">
                Published {history.length}{" "}
                {history.length === 1 ? "time" : "times"}
                {history[0] && <>, last {relativeTime(history[0].createdAt)}</>}
              </p>
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
