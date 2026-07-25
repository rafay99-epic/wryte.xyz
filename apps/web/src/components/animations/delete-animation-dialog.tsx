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
import { useMutation, useQuery } from "convex/react";
import { AlertCircle, FileText, Loader2, Trash2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";

export type DeletableAnimation = {
  _id: Id<"animations">;
  name: string;
};

/**
 * Reference-checked delete. On open it scans the project's post bodies for
 * `<Name` usages (server-side, delete-time only — see animations.usage):
 *
 *  - referenced → delete is BLOCKED; every referencing post is listed with
 *    a direct editor link so the author can remove the tags first;
 *  - unreferenced → a normal confirm-and-delete.
 *
 * Shared by the gallery cards, the gallery edit sheet, and the editor's
 * insert dialog so the safety rule can't be bypassed from any surface.
 */
export function DeleteAnimationDialog({
  projectId,
  animation,
  onClose,
  onDeleted,
}: {
  projectId: Id<"projects">;
  animation: DeletableAnimation | null;
  onClose: () => void;
  /** Called after a successful delete (e.g. to also close a parent sheet). */
  onDeleted?: () => void;
}) {
  const open = animation !== null;
  const usage = useQuery(
    api.cms.animations.usage,
    animation ? { projectId, name: animation.name } : "skip",
  );
  const removeAnimation = useMutation(api.cms.animations.remove);
  const [deleting, setDeleting] = useState(false);

  const checking = open && usage === undefined;
  const blocked = (usage?.posts.length ?? 0) > 0;

  async function handleDelete() {
    if (!animation) return;
    setDeleting(true);
    try {
      await removeAnimation({ animationId: animation._id });
      toast.success(`${animation.name} deleted`);
      onClose();
      onDeleted?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't delete");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete {animation?.name}?</DialogTitle>
          <DialogDescription>
            {checking
              ? "Checking your posts for usages…"
              : blocked
                ? "This animation is still used. Remove the tag from these posts first — deleting now would leave them with a broken component on their next publish."
                : "No posts reference this animation. This can't be undone."}
          </DialogDescription>
        </DialogHeader>

        {checking && (
          <div className="flex items-center gap-2 py-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Scanning post bodies…
          </div>
        )}

        {blocked && usage && animation && (
          <div className="space-y-1.5">
            {usage.posts.map((p) => (
              <Link
                key={p.documentId}
                href={`/editor/${p.documentId}`}
                onClick={onClose}
                className="flex items-center gap-2 rounded-lg border border-border/60 px-3 py-2 text-sm transition-colors hover:border-primary/50 hover:bg-muted/40"
              >
                <FileText className="size-3.5 shrink-0 text-muted-foreground" />
                <span className="truncate">{p.title}</span>
                <span className="ml-auto shrink-0 font-mono text-[11px] text-muted-foreground">
                  &lt;{animation.name} /&gt;
                </span>
              </Link>
            ))}
          </div>
        )}

        {usage?.truncated && (
          <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-500">
            <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
            <span>
              This project has more posts than the usage scan covers — some
              references may not be listed.
            </span>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {blocked ? "Close" : "Cancel"}
          </Button>
          {!blocked && (
            <Button
              variant="destructive"
              onClick={() => void handleDelete()}
              disabled={checking || deleting}
            >
              {deleting ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : (
                <Trash2 className="mr-2 size-4" />
              )}
              Delete
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
