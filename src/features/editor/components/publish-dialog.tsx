"use client";

import { useAction, useMutation, useQuery } from "convex/react";
import { Loader2, Send, Share2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useShallow } from "zustand/react/shallow";
import { SocialPostField } from "@/components/forms/social-post-field";
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
import { Switch } from "@/components/ui/switch";
import { getFileExtension } from "@/lib/content-format";
import { buildFrontmatter } from "@/lib/markdown";
import {
  buildPublishedUrl,
  DEFAULT_SOCIAL_TEMPLATE,
  renderSocialText,
} from "@/lib/social-template";
import { useEditorStore } from "@/stores/editor-store";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { PublishChecklist } from "./publish-checklist";

const documentsUpdate = api.cms.documents.update;
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

  const socialConfig = useQuery(
    api.social.credentialsDb.getPublicConfig,
    projectId ? { projectId: projectId as Id<"projects"> } : "skip",
  );

  const publishToGithub = useAction(publishAction);
  const updateDocument = useMutation(documentsUpdate);

  // If the document already has a GitHub SHA, this is an update (not a first publish)
  const isUpdate = Boolean(document?.githubSha);
  const defaultCommitMessage = isUpdate
    ? `Update ${title || "document"}`
    : `Add ${title || "document"}`;

  const [commitMessage, setCommitMessage] = useState(defaultCommitMessage);
  const [socialPostText, setSocialPostText] = useState("");
  const [includeSocialPost, setIncludeSocialPost] = useState(true);

  const socialEnabled =
    project?.socialPostOnPublish === true &&
    socialConfig?.status === "active" &&
    Boolean(project?.siteUrl);

  // Seed the textarea with the raw TEMPLATE; the server resolves the
  // placeholders at publish time. The preview below shows the resolved text.
  const defaultSocialTemplate = useMemo(() => {
    if (!socialEnabled) return "";
    let parsed: { postTemplate?: string } | null = null;
    if (socialConfig?.publicConfig) {
      try {
        parsed = JSON.parse(socialConfig.publicConfig);
      } catch {
        /* corrupted config — fall through to default template */
      }
    }
    return parsed?.postTemplate || DEFAULT_SOCIAL_TEMPLATE;
  }, [socialEnabled, socialConfig?.publicConfig]);

  const socialPreview = useMemo(
    () => ({
      title: title || "Untitled",
      url: buildPublishedUrl(project?.siteUrl, document?.slug),
    }),
    [project?.siteUrl, document?.slug, title],
  );

  // Reset commit message to the current default each time the dialog opens
  useEffect(() => {
    if (open) {
      setCommitMessage(
        isUpdate
          ? `Update ${title || "document"}`
          : `Add ${title || "document"}`,
      );
      setSocialPostText(defaultSocialTemplate);
      setIncludeSocialPost(true);
    }
  }, [open, isUpdate, title, defaultSocialTemplate]);

  // Compute the target file path in the repo for display purposes
  const contentPath = project?.contentPath ?? "content";
  const slug = document?.slug ?? "untitled";
  const filePath = `${contentPath}/${slug}${getFileExtension(project?.contentFormat)}`;

  // Capture a single "now" timestamp keyed by `open` so the preview's date
  // refreshes when the dialog reopens but doesn't tick on every parent
  // render. The action recomputes on the server at publish-time, so this
  // value is purely for the YAML preview shown in the dialog.
  // biome-ignore lint/correctness/useExhaustiveDependencies: ISO timestamp is intentionally re-computed per dialog open
  const dateIso = useMemo(() => new Date().toISOString(), [open]);

  const frontmatterPreview = useMemo(() => {
    if (document?.frontmatter) {
      try {
        const parsed = JSON.parse(document.frontmatter) as Record<
          string,
          unknown
        >;
        return buildFrontmatter({
          title,
          ...parsed,
          date: dateIso,
        });
      } catch {
        return buildFrontmatter({ title, date: dateIso });
      }
    }
    return buildFrontmatter({ title, date: dateIso });
  }, [document?.frontmatter, title, dateIso]);

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
      if (useEditorStore.getState().isDirty) {
        await updateDocument({
          documentId: documentId as Id<"documents">,
          content,
          title,
        });
        useEditorStore.getState().markSaved();
      }
      const trimmedMessage = commitMessage.trim();
      const trimmedSocial =
        socialEnabled && includeSocialPost ? socialPostText.trim() : "";
      await publishToGithub({
        documentId: documentId as Id<"documents">,
        ...(trimmedMessage && { commitMessage: trimmedMessage }),
        ...(trimmedSocial && { socialPostText: trimmedSocial }),
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

          {/* Social post text */}
          {socialEnabled && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label
                  htmlFor="social-post-text"
                  className="flex items-center gap-1.5"
                >
                  <Share2 className="size-3 text-muted-foreground" />
                  Social announcement
                </Label>
                <Switch
                  checked={includeSocialPost}
                  onCheckedChange={setIncludeSocialPost}
                />
              </div>
              {includeSocialPost ? (
                <SocialPostField
                  id="social-post-text"
                  value={socialPostText}
                  onChange={setSocialPostText}
                  previewValues={socialPreview}
                />
              ) : (
                <div className="space-y-1.5 rounded-lg bg-muted/40 px-3 py-2.5">
                  <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/50">
                    Default message
                  </p>
                  <p className="whitespace-pre-wrap break-words text-xs leading-relaxed text-foreground/75">
                    {renderSocialText(defaultSocialTemplate, socialPreview)}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Pre-publish checklist — advisory only, never blocks publishing */}
          {projectId && (
            <PublishChecklist
              open={open}
              projectId={projectId}
              frontmatterRaw={document?.frontmatter}
              frontmatterSchema={project?.frontmatterSchema}
              contentFormat={project?.contentFormat}
            />
          )}
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
