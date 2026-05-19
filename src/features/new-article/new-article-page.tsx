"use client";

import { useMutation, useQuery } from "convex/react";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Check,
  ChevronsUpDown,
  FileText,
  FolderOpen,
  Globe,
  Hash,
  Loader2,
  PenLine,
  Search,
  Sparkles,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { buildInitialFrontmatter } from "@/lib/build-initial-frontmatter";
import { getFileExtension } from "@/lib/content-format";
import { generateSlug } from "@/lib/markdown";
import { cn } from "@/lib/utils";
import { useEditorStore } from "@/stores/editor-store";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

/**
 * Full-page "New Article" flow launched from the dashboard. Lets the
 * author pick a destination project (searchable combobox so it scales to
 * many projects), give the article a title, and override the auto-
 * generated slug. Mirrors the in-project `/projects/:id/documents/new`
 * page's design so authors get a consistent feel regardless of where they
 * started.
 */
export function NewArticlePage() {
  const router = useRouter();
  const projects = useQuery(api.cms.projects.list);
  const createDocument = useMutation(api.cms.documents.create);

  const [selectedProjectId, setSelectedProjectId] = useState<
    Id<"projects"> | undefined
  >(undefined);
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);
  const [isSlugEditing, setIsSlugEditing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Clear the sidebar's "active project" pin so it doesn't visually pretend
  // the user is inside a specific project while picking one here.
  useEffect(() => {
    useEditorStore.getState().setActiveProjectId(null);
  }, []);

  // Frontmatter schema + content path follow whichever project is picked.
  const selectedProject = useQuery(
    api.cms.projects.get,
    selectedProjectId ? { projectId: selectedProjectId } : "skip",
  );

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

  // File path preview shows where the article will land in the repo.
  const filePath = useMemo(() => {
    const contentDir = selectedProject?.contentPath || "content/blog";
    const s = slug || "my-new-post";
    return `${contentDir}/${s}${getFileExtension(selectedProject?.contentFormat)}`;
  }, [selectedProject?.contentPath, selectedProject?.contentFormat, slug]);

  const handleSubmit = useCallback(async () => {
    if (!selectedProjectId) {
      toast.error("Pick a project first");
      return;
    }

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
        selectedProject?.frontmatterSchema,
        trimmedTitle,
        trimmedSlug,
        {
          defaultAuthor: selectedProject?.defaultAuthor,
          defaultAuthorAvatar: selectedProject?.defaultAuthorAvatar,
          siteUrl: selectedProject?.siteUrl,
        },
      );
      const documentId = await createDocument({
        projectId: selectedProjectId,
        title: trimmedTitle,
        slug: trimmedSlug,
        frontmatter,
      });
      toast.success("Article created — opening editor");
      router.push(`/editor/${documentId}`);
    } catch {
      toast.error("Failed to create article");
    } finally {
      setIsSubmitting(false);
    }
  }, [
    title,
    slug,
    selectedProjectId,
    selectedProject?.frontmatterSchema,
    selectedProject?.defaultAuthor,
    selectedProject?.defaultAuthorAvatar,
    selectedProject?.siteUrl,
    createDocument,
    router,
  ]);

  // Submit on Enter inside the title field once a project is picked.
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        void handleSubmit();
      }
    },
    [handleSubmit],
  );

  const projectsLoaded = projects !== undefined;
  const hasProjects = projectsLoaded && projects.length > 0;

  return (
    <div className="flex h-full flex-col">
      {/* Breadcrumb */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
        className="flex items-center gap-2 border-b border-border/40 px-6 py-3"
      >
        <button
          type="button"
          onClick={() => router.push("/dashboard")}
          className="text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          Dashboard
        </button>
        <span className="text-xs text-muted-foreground/40">/</span>
        <span className="text-xs font-medium text-foreground">New article</span>
      </motion.div>

      {/* Body */}
      <div className="flex flex-1 items-center justify-center px-6">
        <div className="w-full max-w-xl">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
            className="mb-8 text-center"
          >
            <div className="mx-auto mb-3 flex size-11 items-center justify-center rounded-2xl bg-primary/10">
              <PenLine className="size-5 text-primary" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight">
              Start a new article
            </h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Pick a project, give your article a title, and you&apos;re ready
              to write.
            </p>
          </motion.div>

          {!projectsLoaded ? (
            <div className="rounded-xl border border-border/40 bg-card/50 px-4 py-6 text-center text-sm text-muted-foreground">
              <Loader2 className="mx-auto mb-2 size-4 animate-spin" />
              Loading projects…
            </div>
          ) : !hasProjects ? (
            <div className="rounded-xl border border-dashed border-border/40 px-6 py-10 text-center">
              <p className="mb-4 text-sm text-muted-foreground">
                You need a project before you can create an article.
              </p>
              <Button onClick={() => router.push("/projects/new")}>
                Create a project
              </Button>
            </div>
          ) : (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: 0.4,
                delay: 0.1,
                ease: [0.25, 0.1, 0.25, 1],
              }}
              className="space-y-3"
            >
              {/* Project picker — sits at the top of the form so the user
                  commits to a destination before naming. */}
              <ProjectPicker
                id="new-article-project"
                projects={projects}
                value={selectedProjectId}
                onChange={setSelectedProjectId}
              />

              {/* Title — the hero */}
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
                  className="w-full rounded-xl border border-border/60 bg-card px-4 py-3.5 pl-12 text-lg font-medium tracking-tight text-foreground outline-none transition-all placeholder:text-muted-foreground/40 focus:border-primary/40 focus:ring-2 focus:ring-primary/10"
                />
              </div>

              {/* Slug */}
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
                    className="h-auto min-w-0 border-0 bg-transparent p-0 font-mono text-xs shadow-none focus-visible:ring-0"
                    autoFocus
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => setIsSlugEditing(true)}
                    className="min-w-0 truncate font-mono text-xs text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {slug || "article-slug"}
                  </button>
                )}
              </div>

              {/* File path preview */}
              {selectedProjectId && slug && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  transition={{ duration: 0.2 }}
                  className="flex min-w-0 items-center gap-2 px-1"
                >
                  <Globe className="size-3 shrink-0 text-muted-foreground/40" />
                  <span className="min-w-0 truncate font-mono text-[11px] text-muted-foreground/50">
                    {filePath}
                  </span>
                </motion.div>
              )}

              {/* Actions */}
              <div className="mt-2 flex items-center justify-between">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => router.push("/dashboard")}
                  className="text-muted-foreground"
                >
                  Cancel
                </Button>

                <Button
                  size="lg"
                  onClick={() => void handleSubmit()}
                  disabled={isSubmitting || !selectedProjectId || !title.trim()}
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
              </div>

              {/* Keyboard hint */}
              <p className="text-center text-[11px] text-muted-foreground/40">
                Press{" "}
                <kbd className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground/60">
                  Enter
                </kbd>{" "}
                to create
              </p>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Project picker — searchable combobox                                */
/* ------------------------------------------------------------------ */

/**
 * Inline searchable popover for choosing the destination project.
 * Optimised for users with many projects — the list scrolls and the
 * search input filters by substring.
 */
function ProjectPicker({
  id,
  projects,
  value,
  onChange,
}: {
  id?: string;
  projects: Array<{ _id: Id<"projects">; name: string }>;
  value: Id<"projects"> | undefined;
  onChange: (id: Id<"projects">) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const selected = useMemo(
    () => projects.find((p) => p._id === value) ?? null,
    [projects, value],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return projects;
    return projects.filter((p) => p.name.toLowerCase().includes(q));
  }, [projects, query]);

  useEffect(() => {
    if (open) {
      setQuery("");
      const t = window.setTimeout(() => inputRef.current?.focus(), 0);
      return () => window.clearTimeout(t);
    }
    return;
  }, [open]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            id={id}
            type="button"
            variant="outline"
            className="h-11 w-full justify-between rounded-xl border-border/60 bg-card px-4 font-normal"
          />
        }
      >
        <span className="flex items-center gap-2 truncate text-left text-sm">
          <FolderOpen className="size-4 shrink-0 text-muted-foreground/70" />
          <span
            className={cn("truncate", !selected && "text-muted-foreground/60")}
          >
            {selected ? selected.name : "Choose a project…"}
          </span>
        </span>
        <ChevronsUpDown className="size-3.5 shrink-0 text-muted-foreground/60" />
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={6}
        // Anchor-matched width so the popover reads as a proper dropdown
        // attached to the trigger instead of a floating island. Base UI
        // exposes the trigger width via the `--anchor-width` CSS var.
        className="w-(--anchor-width) min-w-56 overflow-hidden p-0"
      >
        <div className="border-b border-border/40 p-1.5">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground/60" />
            <Input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search projects…"
              className="h-8 border-0 bg-transparent pl-7 shadow-none focus-visible:ring-0"
            />
          </div>
        </div>
        <div className="max-h-64 overflow-y-auto p-1">
          {filtered.length === 0 ? (
            <p className="px-3 py-4 text-center text-xs text-muted-foreground">
              No matching project
            </p>
          ) : (
            filtered.map((p) => {
              const isSelected = p._id === value;
              return (
                <button
                  key={p._id}
                  type="button"
                  onClick={() => {
                    onChange(p._id);
                    setOpen(false);
                  }}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-[13px] transition-colors hover:bg-muted",
                    isSelected && "bg-muted/60",
                  )}
                >
                  <Check
                    className={cn(
                      "size-3.5 shrink-0",
                      isSelected ? "text-primary" : "opacity-0",
                    )}
                  />
                  <FolderOpen className="size-3.5 shrink-0 text-muted-foreground" />
                  <span className="flex-1 truncate">{p.name}</span>
                </button>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
