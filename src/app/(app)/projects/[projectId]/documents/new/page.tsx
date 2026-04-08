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
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { generateSlug } from "@/lib/markdown";
import { useEditorStore } from "@/stores/editor-store";
import { api } from "../../../../../../../convex/_generated/api";
import type { Id } from "../../../../../../../convex/_generated/dataModel";

/**
 * Redesigned "New Article" page with a clean, immersive UI.
 *
 * Features a large title input as the hero element, an auto-generated slug
 * preview, and a prominent CTA. The layout uses the full content area
 * for a focused, distraction-free creation experience.
 */
export default function NewDocumentPage() {
  const params = useParams<{ projectId: string }>();
  const projectId = params.projectId as Id<"projects">;
  const router = useRouter();

  const project = useQuery(api.projects.get, { projectId });
  const createDocument = useMutation(api.documents.create);

  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);
  const [isSlugEditing, setIsSlugEditing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Set active project in sidebar on mount
  useEffect(() => {
    useEditorStore.getState().setActiveProjectId(projectId);
  }, [projectId]);

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

  // Derive the full file path preview
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
      const documentId = await createDocument({
        projectId,
        title: trimmedTitle,
        slug: trimmedSlug,
      });
      toast.success("Article created — opening editor");
      router.push(`/editor/${documentId}`);
    } catch {
      toast.error("Failed to create article");
    } finally {
      setIsSubmitting(false);
    }
  }, [title, slug, projectId, createDocument, router]);

  // Submit on Enter in the title field
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
    <div className="flex h-full flex-col">
      {/* Top bar — subtle breadcrumb */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
        className="flex items-center gap-2 border-b border-border/40 px-6 py-3"
      >
        <button
          type="button"
          onClick={() => router.push(`/projects/${projectId}`)}
          className="text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          {project?.name || "Project"}
        </button>
        <span className="text-xs text-muted-foreground/40">/</span>
        <span className="text-xs font-medium text-foreground">New Article</span>
      </motion.div>

      {/* Main content — centered, spacious */}
      <div className="flex flex-1 items-center justify-center px-6">
        <div className="w-full max-w-xl">
          {/* Icon + heading */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
            className="mb-10 text-center"
          >
            <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-2xl bg-primary/10">
              <PenLine className="size-6 text-primary" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight">
              Start a new article
            </h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Give your article a title and you&apos;re ready to write.
            </p>
          </motion.div>

          {/* Title input — the hero */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: 0.4,
              delay: 0.1,
              ease: [0.25, 0.1, 0.25, 1],
            }}
            className="space-y-5"
          >
            <div className="group relative">
              <div className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground/40 transition-colors group-focus-within:text-primary/60">
                <FileText className="size-5" />
              </div>
              <input
                type="text"
                value={title}
                onChange={(e) => handleTitleChange(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Article title..."
                className="w-full rounded-xl border border-border/60 bg-card px-4 py-4 pl-12 text-lg font-medium tracking-tight text-foreground outline-none transition-all placeholder:text-muted-foreground/40 focus:border-primary/40 focus:ring-2 focus:ring-primary/10"
              />
            </div>

            {/* Slug row */}
            <div className="flex items-center gap-2">
              <div className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-border/40 bg-muted/30 px-3 py-2.5">
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

          {/* Actions */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: 0.4,
              delay: 0.2,
              ease: [0.25, 0.1, 0.25, 1],
            }}
            className="mt-8 flex items-center justify-between"
          >
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push(`/projects/${projectId}`)}
              className="text-muted-foreground"
            >
              Cancel
            </Button>

            <Button
              size="lg"
              onClick={() => void handleSubmit()}
              disabled={isSubmitting || !title.trim()}
              className="gap-2 px-6"
            >
              {isSubmitting ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Sparkles className="size-4" />
              )}
              Create & Start Writing
              {!isSubmitting && <ArrowRight className="size-3.5" />}
            </Button>
          </motion.div>

          {/* Keyboard hint */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5, duration: 0.4 }}
            className="mt-4 text-center text-[11px] text-muted-foreground/40"
          >
            Press{" "}
            <kbd className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground/60">
              Enter
            </kbd>{" "}
            to create
          </motion.p>
        </div>
      </div>
    </div>
  );
}
