"use client";

import { useAction, useMutation } from "convex/react";
import { AlertTriangle, Cloud, FileText, Loader2 } from "lucide-react";
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
import { cn } from "@/lib/utils";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";

export type DeleteTarget = {
  documentId: Id<"documents">;
  title: string;
  githubPath?: string;
  githubSha?: string;
};

type DeleteDocumentDialogProps = {
  target: DeleteTarget;
  projectId: Id<"projects">;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function DeleteDocumentDialog({
  target,
  projectId,
  open,
  onOpenChange,
}: DeleteDocumentDialogProps) {
  const removeDocument = useMutation(api.cms.documents.remove);
  const deleteFromGithub = useAction(
    api.integrations.github.deleteFileFromGithub,
  );
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteMode, setDeleteMode] = useState<"local" | "github" | "both">(
    "local",
  );

  const isSynced = Boolean(target.githubPath);

  const handleDelete = useCallback(async () => {
    setIsDeleting(true);
    try {
      if (deleteMode === "local" || deleteMode === "both") {
        await removeDocument({ documentId: target.documentId });
      }

      if (
        (deleteMode === "github" || deleteMode === "both") &&
        target.githubPath &&
        target.githubSha
      ) {
        await deleteFromGithub({
          projectId,
          filePath: target.githubPath,
          sha: target.githubSha,
        });
      }

      const messages: Record<string, string> = {
        local: "Local copy deleted",
        github: "Deleted from GitHub",
        both: "Deleted from both local and GitHub",
      };
      toast.success(messages[deleteMode]);
      onOpenChange(false);
    } catch {
      toast.error("Failed to delete document");
    } finally {
      setIsDeleting(false);
    }
  }, [
    deleteMode,
    target,
    projectId,
    removeDocument,
    deleteFromGithub,
    onOpenChange,
  ]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete Document</DialogTitle>
          <DialogDescription>
            {isSynced
              ? `Choose how to delete "${target.title}". This document is synced with GitHub.`
              : `Are you sure you want to delete "${target.title}"? This action cannot be undone.`}
          </DialogDescription>
        </DialogHeader>

        {isSynced && (
          <div className="flex flex-col gap-2 py-2">
            <DeleteModeOption
              selected={deleteMode === "local"}
              onClick={() => setDeleteMode("local")}
              icon={<FileText className="size-4 text-muted-foreground" />}
              label="Delete local copy only"
              description="Remove from Wryte but keep the file on GitHub"
            />
            <DeleteModeOption
              selected={deleteMode === "github"}
              onClick={() => setDeleteMode("github")}
              icon={<Cloud className="size-4 text-blue-500" />}
              label="Delete from GitHub only"
              description="Remove from GitHub but keep the local copy in Wryte"
            />
            <DeleteModeOption
              selected={deleteMode === "both"}
              onClick={() => setDeleteMode("both")}
              icon={<AlertTriangle className="size-4 text-destructive" />}
              label="Delete both copies"
              description="Remove from Wryte and GitHub permanently"
            />
          </div>
        )}

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
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DeleteModeOption({
  selected,
  onClick,
  icon,
  label,
  description,
}: {
  selected: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  description: string;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
      className={cn(
        "flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors",
        selected
          ? "border-primary bg-primary/5 ring-1 ring-primary"
          : "border-border hover:bg-muted/50",
      )}
    >
      <div
        className={cn(
          "flex size-4 shrink-0 items-center justify-center rounded-full border-2",
          selected ? "border-primary" : "border-muted-foreground/30",
        )}
      >
        {selected && <div className="size-2 rounded-full bg-primary" />}
      </div>
      <div className="flex items-center gap-2">
        {icon}
        <div>
          <p className="text-sm font-medium">{label}</p>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
      </div>
    </div>
  );
}
