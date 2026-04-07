"use client";

import { useAction } from "convex/react";
import { Loader2 } from "lucide-react";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";

export interface RemoteDeleteTarget {
  path: string;
  sha: string;
  title: string;
}

interface DeleteRemoteFileDialogProps {
  target: RemoteDeleteTarget;
  projectId: Id<"projects">;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDeleted: () => void;
}

export function DeleteRemoteFileDialog({
  target,
  projectId,
  open,
  onOpenChange,
  onDeleted,
}: DeleteRemoteFileDialogProps) {
  const deleteFromGithub = useAction(api.github.deleteFileFromGithub);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = useCallback(async () => {
    setIsDeleting(true);
    try {
      let githubAccessToken: string | undefined;
      try {
        const res = await fetch("/api/github/token");
        if (res.ok) {
          const data = (await res.json()) as { token?: string };
          if (data.token) githubAccessToken = data.token;
        }
      } catch {
        // Fall back to stored PAT
      }

      const ghArgs: {
        projectId: Id<"projects">;
        filePath: string;
        sha: string;
        githubAccessToken?: string;
      } = {
        projectId,
        filePath: target.path,
        sha: target.sha,
      };
      if (githubAccessToken) ghArgs.githubAccessToken = githubAccessToken;
      await deleteFromGithub(ghArgs);

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
