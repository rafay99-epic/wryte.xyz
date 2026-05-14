"use client";

import { useMutation, useQuery } from "convex/react";
import { motion } from "framer-motion";
import {
  ArrowRight,
  FileText,
  Globe,
  Hash,
  Loader2,
  PenLine,
  Sparkles,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { buildInitialFrontmatter } from "@/lib/build-initial-frontmatter";
import { generateSlug } from "@/lib/markdown";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";

type CreateDocumentDialogProps = {
  projectId: Id<"projects">;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Optional initial status for the new document (e.g., from a board column's "+" button). */
  initialStatus?: string | undefined;
};

/**
 * Dialog-mode "New article" flow used from within a project. Mirrors the
 * full-page `/articles/new` design so the two creation surfaces feel like
 * variations of the same screen: same hero icon, same hero title input,
 * same slug pill, same file-path preview. The project is implicit (the
 * dialog only opens from inside a project page) so there's no picker.
 */
export function CreateDocumentDialog({
  projectId,
  open,
  onOpenChange,
  initialStatus,
}: CreateDocumentDialogProps) {
  const router = useRouter();
  const createDocument = useMutation(api.cms.documents.create);
  const project = useQuery(api.cms.projects.get, { projectId });

  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);
  const [isSlugEditing, setIsSlugEditing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reset form when the dialog closes so a stale draft doesn't leak into
  // the next open. (The submit path clears state too, but cancelling via
  // the close button needs the same treatment.)
  useEffect(() => {
    if (!open) {
      setTitle("");
      setSlug("");
      setSlugManuallyEdited(false);
      setIsSlugEditing(false);
    }
  }, [open]);

  const handleTitleChange = useCallback(
    (value: string) => {
      setTitle(value);
      if (!slugManuallyEdited) {
        setSlug(generateSlug(value));
      }
    },
    [slugManuallyEdited],
  );

  const handleSlugChange = useCallback((value: string) => {
    setSlugManuallyEdited(true);
    setSlug(generateSlug(value));
  }, []);

  // Preview of where the article will land in the repo. Matches the
  // articles/new page so the two surfaces give identical feedback.
  const filePath = useMemo(() => {
    const contentDir = project?.contentPath || "content/blog";
    const s = slug || "my-new-post";
    return `${contentDir}/${s}.md`;
  }, [project?.contentPath, slug]);

  const handleSubmit = useCallback(async () => {
    const trimmedTitle = title.trim();
    const trimmedSlug = slug.trim();

    if (!trimmedTitle) {
      toast.error("Title is required");
      return;
    }
    if (!trimmedSlug) {
      toast.error("Slug is required");
      return;
    }

    setIsSubmitting(true);
    try {
      const frontmatter = buildInitialFrontmatter(
        project?.frontmatterSchema,
        trimmedTitle,
        trimmedSlug,
        {
          defaultAuthor: project?.defaultAuthor,
          defaultAuthorAvatar: project?.defaultAuthorAvatar,
          siteUrl: project?.siteUrl,
        },
      );
      const args: {
        projectId: Id<"projects">;
        title: string;
        slug: string;
        status?: string;
        frontmatter?: string;
      } = {
        projectId,
        title: trimmedTitle,
        slug: trimmedSlug,
        frontmatter,
      };
      if (initialStatus) {
        args.status = initialStatus;
      }
      const documentId = await createDocument(args);
      toast.success("Article created — opening editor");
      onOpenChange(false);
      router.push(`/editor/${documentId}`);
    } catch {
      toast.error("Failed to create article");
    } finally {
      setIsSubmitting(false);
    }
  }, [
    title,
    slug,
    projectId,
    project?.frontmatterSchema,
    project?.defaultAuthor,
    project?.defaultAuthorAvatar,
    project?.siteUrl,
    createDocument,
    onOpenChange,
    router,
    initialStatus,
  ]);

  // Enter submits from anywhere inside the form.
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        void handleSubmit();
      }
    },
    [handleSubmit],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-0 p-0 sm:max-w-lg">
        <div className="px-6 pt-8 pb-2">
          {/* Hero — same icon + heading as /articles/new */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, ease: [0.25, 0.1, 0.25, 1] }}
            className="mb-7 text-center"
          >
            <div className="mx-auto mb-3 flex size-11 items-center justify-center rounded-2xl bg-primary/10">
              <PenLine className="size-5 text-primary" />
            </div>
            <DialogTitle className="text-xl font-bold tracking-tight">
              New article
            </DialogTitle>
            <p className="mt-1.5 text-sm text-muted-foreground">
              {project?.name ? (
                <>
                  in{" "}
                  <span className="font-medium text-foreground/80">
                    {project.name}
                  </span>
                </>
              ) : (
                "Pick a title and start writing."
              )}
            </p>
          </motion.div>

          {/* Fields */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: 0.3,
              delay: 0.05,
              ease: [0.25, 0.1, 0.25, 1],
            }}
            className="space-y-3"
          >
            {/* Title — hero input */}
            <div className="group relative">
              <div className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-muted-foreground/40 transition-colors group-focus-within:text-primary/60">
                <FileText className="size-5" />
              </div>
              <input
                type="text"
                value={title}
                onChange={(e) => handleTitleChange(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Article title..."
                autoFocus
                className="w-full rounded-xl border border-border/60 bg-card px-4 py-3.5 pl-12 text-lg font-medium tracking-tight text-foreground outline-none transition-all placeholder:text-muted-foreground/40 focus:border-primary/40 focus:ring-2 focus:ring-primary/10"
              />
            </div>

            {/* Slug pill */}
            <div className="flex min-w-0 items-center gap-2 rounded-lg border border-border/40 bg-muted/30 px-3 py-2">
              <Hash className="size-3.5 shrink-0 text-muted-foreground/50" />
              {isSlugEditing ? (
                <Input
                  value={slug}
                  onChange={(e) => handleSlugChange(e.target.value)}
                  onBlur={() => setIsSlugEditing(false)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      setIsSlugEditing(false);
                    }
                  }}
                  className="h-auto border-0 bg-transparent p-0 font-mono text-xs shadow-none focus-visible:ring-0"
                  autoFocus
                />
              ) : (
                <button
                  type="button"
                  onClick={() => setIsSlugEditing(true)}
                  className="truncate font-mono text-xs text-muted-foreground transition-colors hover:text-foreground"
                >
                  {slug || "article-slug"}
                </button>
              )}
            </div>

            {/* File path preview */}
            {slug && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                transition={{ duration: 0.2 }}
                className="flex items-center gap-2 px-1"
              >
                <Globe className="size-3 shrink-0 text-muted-foreground/40" />
                <span className="truncate font-mono text-[11px] text-muted-foreground/50">
                  {filePath}
                </span>
              </motion.div>
            )}
          </motion.div>
        </div>

        {/* Footer — Cancel + primary CTA, matched to /articles/new */}
        <div className="mt-2 flex items-center justify-between gap-3 border-t border-border/40 bg-muted/30 px-6 py-3">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="text-muted-foreground"
          >
            Cancel
          </Button>
          <Button
            type="button"
            size="lg"
            onClick={() => void handleSubmit()}
            disabled={isSubmitting || !title.trim()}
            className="gap-2 px-5"
          >
            {isSubmitting ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Sparkles className="size-4" />
            )}
            Create & Start Writing
            {!isSubmitting && <ArrowRight className="size-3.5" />}
          </Button>
        </div>

        {/* Keyboard hint — sits below the footer separator for the same
            tone as /articles/new */}
        <p className="px-6 pb-4 text-center text-[11px] text-muted-foreground/40">
          Press{" "}
          <kbd className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground/60">
            Enter
          </kbd>{" "}
          to create
        </p>
      </DialogContent>
    </Dialog>
  );
}
