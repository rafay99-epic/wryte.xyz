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
import { useAction } from "convex/react";
import { Loader2 } from "lucide-react";
import { useCallback, useState } from "react";
import { toast } from "sonner";

export type RemoteDeleteTarget = {
  path: string;
  sha: string;
  title: string;
};

type DeleteRemoteFileDialogProps = {
  target: RemoteDeleteTarget;
  projectId: Id<"projects">;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDeleted: () => void;
};

export function DeleteRemoteFileDialog({
  target,
  projectId,
  open,
  onOpenChange,
  onDeleted,
}: DeleteRemoteFileDialogProps) {
  const deleteFromGithub = useAction(
    api.integrations.github.deleteFileFromGithub,
  );
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = useCallback(async () => {
    setIsDeleting(true);
    try {
      await deleteFromGithub({
        projectId,
        filePath: target.path,
        sha: target.sha,
      });

      toast.success(`Deleted "${target.title}" from GitHub`);
      onOpenChange(false);
      onDeleted();
    } catch {
      toast.error("Failed to delete file from GitHub");
    } finally {
      setIsDeleting(false);
    }
  }, [target, projectId, deleteFromGithub, onOpenChange, onDeleted]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete from GitHub</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete &ldquo;{target.title}&rdquo; from
            GitHub? This will remove the file from the repository. This action
            cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={isDeleting}
          >
            {isDeleting && <Loader2 className="size-4 animate-spin" />}
            Delete from GitHub
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
