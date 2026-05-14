"use client";

import { useAction, useQuery } from "convex/react";
import { Loader2, Send } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useShallow } from "zustand/react/shallow";
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
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

const documentsGet = api.cms.documents.get;
const projectsGet = api.cms.projects.get;
const publishAction = api.integrations.github.publish;

type PublishDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documentId: string;
  projectId: string;
};

/**
 * Dialog that previews and triggers publishing a document to GitHub.
 * Shows the target file path, generated YAML frontmatter, content preview,
 * and a commit message field before the user confirms.
 *
 * On publish, attempts to fetch an OAuth token from Clerk first (for users
 * who connected GitHub via OAuth). Falls back to a stored Personal Access Token
 * if the OAuth route is unavailable.
 */
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
  const project = useQuery(
    projectsGet,
    projectId ? { projectId: projectId as Id<"projects"> } : "skip",
  );

  const publishToGithub = useAction(publishAction);

  // If the document already has a GitHub SHA, this is an update (not a first publish)
  const isUpdate = Boolean(document?.githubSha);
  const defaultCommitMessage = isUpdate
    ? `Update ${title || "document"}`
    : `Add ${title || "document"}`;

  const [commitMessage, setCommitMessage] = useState(defaultCommitMessage);

  // Compute the target file path in the repo for display purposes
  const contentPath = project?.contentPath ?? "content";
  const slug = document?.slug ?? "untitled";
  const filePath = `${contentPath}/${slug}.md`;

  // Build a YAML frontmatter preview by merging the document's saved frontmatter
  // with a title and current timestamp. This shows the user exactly what will be
  // written to the file's front matter block.
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

  /**
   * Publishes the document. The Convex action resolves the GitHub token
   * server-side (Clerk OAuth → vault PAT → legacy), so the client doesn't
   * touch credentials at all.
   */
  async function handlePublish() {
    setIsPublishing(true);
    try {
      await publishToGithub({ documentId: documentId as Id<"documents"> });
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
            <pre className="max-h-32 overflow-y-auto rounded-md bg-muted px-3 py-2 font-mono text-xs whitespace-pre-wrap">
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
