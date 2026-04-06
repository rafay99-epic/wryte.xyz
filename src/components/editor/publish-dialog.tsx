"use client";

import { useAction, useQuery } from "convex/react";
import { Loader2, Send } from "lucide-react";
import { useState } from "react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { buildFrontmatter } from "@/lib/markdown";
import { useEditorStore } from "@/stores/editor-store";
import { useShallow } from "zustand/react/shallow";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

// biome-ignore lint/suspicious/noExplicitAny: api types are generated at build time via `npx convex dev`
const documentsGet = (api as any).documents.get;
// biome-ignore lint/suspicious/noExplicitAny: api types are generated at build time via `npx convex dev`
const projectsGet = (api as any).projects.get;
// biome-ignore lint/suspicious/noExplicitAny: api types are generated at build time via `npx convex dev`
const publishAction = (api as any).github.publish;

interface PublishDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documentId: string;
  projectId: string;
}

export function PublishDialog({
  open,
  onOpenChange,
  documentId,
  projectId,
}: PublishDialogProps) {
  const [isPublishing, setIsPublishing] = useState(false);

  const { content, title } = useEditorStore(
    useShallow((state) => ({
      content: state.content,
      title: state.title,
    })),
  );

  const document = useQuery(documentsGet, {
    documentId: documentId as Id<"documents">,
  });
  const project = useQuery(projectsGet, {
    projectId: projectId as Id<"projects">,
  });

  const publishToGithub = useAction(publishAction);

  const isUpdate = Boolean(document?.githubSha);
  const defaultCommitMessage = isUpdate
    ? `Update ${title || "document"}`
    : `Add ${title || "document"}`;

  const [commitMessage, setCommitMessage] = useState(defaultCommitMessage);

  // Compute file path preview
  const contentPath = project?.contentPath ?? "content";
  const slug = document?.slug ?? "untitled";
  const filePath = `${contentPath}/${slug}.md`;

  // Parse frontmatter for preview
  let frontmatterPreview = "";
  if (document?.frontmatter) {
    try {
      const parsed = JSON.parse(document.frontmatter) as Record<
        string,
        unknown
      >;
      frontmatterPreview = buildFrontmatter({
        title,
        ...parsed,
        date: new Date().toISOString(),
      });
    } catch {
      frontmatterPreview = buildFrontmatter({
        title,
        date: new Date().toISOString(),
      });
    }
  } else {
    frontmatterPreview = buildFrontmatter({
      title,
      date: new Date().toISOString(),
    });
  }

  const contentPreview =
    content.length > 200 ? `${content.slice(0, 200)}...` : content;

  async function handlePublish() {
    setIsPublishing(true);
    try {
      await publishToGithub({
        documentId: documentId as Id<"documents">,
      });
      toast.success("Published successfully!", {
        description: `${title} has been published to GitHub.`,
      });
      onOpenChange(false);
    } catch (err) {
      toast.error("Publish failed", {
        description:
          err instanceof Error ? err.message : "An unknown error occurred.",
      });
    } finally {
      setIsPublishing(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {isUpdate ? "Update on GitHub" : "Publish to GitHub"}
          </DialogTitle>
          <DialogDescription>
            {isUpdate
              ? "This will update the existing file in your repository."
              : "This will create a new file in your GitHub repository."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* File path */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">File path</Label>
            <div className="rounded-md bg-muted px-3 py-2 font-mono text-sm">
              {filePath}
            </div>
          </div>

          {/* Frontmatter preview */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Frontmatter</Label>
            <pre className="max-h-32 overflow-y-auto rounded-md bg-muted px-3 py-2 font-mono text-xs">
              {frontmatterPreview}
            </pre>
          </div>

          {/* Content preview */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">
              Content preview
            </Label>
            <div className="max-h-24 overflow-y-auto rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
              {contentPreview || "No content yet."}
            </div>
          </div>

          {/* Commit message */}
          <div className="space-y-1.5">
            <Label htmlFor="commit-msg">Commit message</Label>
            <Input
              id="commit-msg"
              value={commitMessage}
              onChange={(e) => setCommitMessage(e.target.value)}
              placeholder="Commit message"
            />
          </div>
        </div>

        <DialogFooter>
          <Button onClick={() => void handlePublish()} disabled={isPublishing}>
            {isPublishing ? (
              <>
                <Loader2 className="size-3.5 animate-spin" />
                Publishing...
              </>
            ) : (
              <>
                <Send className="size-3.5" />
                Publish Now
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
