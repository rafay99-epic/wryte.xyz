"use client";

import { api } from "@wryte/backend/_generated/api";
import type { Id } from "@wryte/backend/_generated/dataModel";
import { Button } from "@wryte/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@wryte/ui/dialog";
import { Skeleton } from "@wryte/ui/skeleton";
import { useMutation, useQuery } from "convex/react";
import { RotateCcw, Trash2 } from "lucide-react";
import { useCallback, useState } from "react";
import { toast } from "sonner";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Trash list for a project. Lists soft-deleted documents with their
 * scheduled-cleanup date and one-click Restore / Permanent delete.
 * "Empty trash" requires a confirmation dialog because the action is
 * destructive and large in blast radius.
 */
export function TrashPage({ projectId: rawProjectId }: { projectId: string }) {
  const projectId = rawProjectId as Id<"projects">;

  const data = useQuery(api.cms.trash.listByProject, { projectId });
  const restore = useMutation(api.cms.trash.restore);
  const permanentDelete = useMutation(api.cms.trash.permanentDelete);
  const emptyTrash = useMutation(api.cms.trash.emptyTrash);

  const [emptyConfirmOpen, setEmptyConfirmOpen] = useState(false);
  const [isWorking, setIsWorking] = useState(false);

  const handleRestore = useCallback(
    async (documentId: Id<"documents">, title: string) => {
      setIsWorking(true);
      try {
        await restore({ documentId });
        toast.success(`Restored "${title}".`);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Restore failed");
      } finally {
        setIsWorking(false);
      }
    },
    [restore],
  );

  const handlePermanentDelete = useCallback(
    async (documentId: Id<"documents">, title: string) => {
      if (
        !window.confirm(`Permanently delete "${title}"? This cannot be undone.`)
      )
        return;
      setIsWorking(true);
      try {
        await permanentDelete({ documentId });
        toast.success(`Permanently deleted "${title}".`);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Delete failed");
      } finally {
        setIsWorking(false);
      }
    },
    [permanentDelete],
  );

  const handleEmptyTrash = useCallback(async () => {
    setIsWorking(true);
    try {
      const { deleted } = await emptyTrash({ projectId });
      toast.success(
        `Permanently deleted ${deleted} ${deleted === 1 ? "item" : "items"}.`,
      );
      setEmptyConfirmOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Empty trash failed");
    } finally {
      setIsWorking(false);
    }
  }, [emptyTrash, projectId]);

  if (data === undefined) {
    return <TrashSkeleton projectId={projectId} />;
  }
  if (data === null) {
    return (
      <div className="p-6 text-sm text-muted-foreground">
        Project not found or you don't have access.
      </div>
    );
  }

  const { items, retentionDays } = data;
  const now = Date.now();

  return (
    <div className="p-6">
      <div className="mb-6 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Trash</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Items deleted from this project. Auto-cleaned after{" "}
            <span className="font-medium text-foreground">
              {retentionDays} {retentionDays === 1 ? "day" : "days"}
            </span>
            .
          </p>
        </div>
        {items.length > 0 && (
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setEmptyConfirmOpen(true)}
            disabled={isWorking}
          >
            <Trash2 className="size-3.5" />
            Empty trash
          </Button>
        )}
      </div>

      {items.length === 0 ? (
        <div className="rounded-lg border border-dashed py-16 text-center">
          <Trash2 className="mx-auto mb-3 size-8 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">Trash is empty.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40">
              <tr className="border-b">
                <th className="px-4 py-2 text-left font-medium">Title</th>
                <th className="px-4 py-2 text-left font-medium">Deleted</th>
                <th className="px-4 py-2 text-left font-medium">Expires</th>
                <th className="w-32 px-4 py-2 text-right font-medium">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const expiresAt =
                  (item.trashedAt ?? now) + retentionDays * MS_PER_DAY;
                const daysLeft = Math.max(
                  0,
                  Math.ceil((expiresAt - now) / MS_PER_DAY),
                );
                return (
                  <tr
                    key={item._id}
                    className="border-b last:border-b-0 hover:bg-muted/30"
                  >
                    <td className="px-4 py-2.5">
                      <div className="flex flex-col gap-0.5">
                        <span className="font-medium truncate">
                          {item.title}
                        </span>
                        {item.githubPath && (
                          <span className="font-mono text-xs text-muted-foreground truncate">
                            {item.githubPath}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">
                      {item.trashedAt
                        ? new Date(item.trashedAt).toLocaleString(undefined, {
                            dateStyle: "medium",
                            timeStyle: "short",
                          })
                        : "—"}
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">
                      in {daysLeft} {daysLeft === 1 ? "day" : "days"}
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            void handleRestore(item._id, item.title)
                          }
                          disabled={isWorking}
                        >
                          <RotateCcw className="size-3.5" />
                          Restore
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            void handlePermanentDelete(item._id, item.title)
                          }
                          disabled={isWorking}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={emptyConfirmOpen} onOpenChange={setEmptyConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Empty trash?</DialogTitle>
            <DialogDescription>
              This permanently deletes {items.length}{" "}
              {items.length === 1 ? "item" : "items"} from this project. There
              is no undo.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setEmptyConfirmOpen(false)}
              disabled={isWorking}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => void handleEmptyTrash()}
              disabled={isWorking}
            >
              <Trash2 className="size-3.5" />
              Empty trash
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function TrashSkeleton(_props: { projectId: Id<"projects"> }) {
  return (
    <div className="p-6">
      <div className="mb-6">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="mt-2 h-4 w-64" />
      </div>
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    </div>
  );
}
