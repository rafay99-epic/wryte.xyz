"use client";

import { useMutation, useQuery } from "convex/react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Calendar,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Cloud,
  Loader2,
  Maximize2,
  PanelLeftClose,
  PanelLeftOpen,
  Star,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useShallow } from "zustand/react/shallow";
import { PublishDialog } from "@/components/editor/publish-dialog";
import { ScheduleDialog } from "@/components/editor/schedule-dialog";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useEditorStore } from "@/stores/editor-store";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

// biome-ignore lint/suspicious/noExplicitAny: api types are generated at build time via `npx convex dev`
const projectsGet = (api as any).projects.get;
// biome-ignore lint/suspicious/noExplicitAny: api types are generated at build time via `npx convex dev`
const documentsGet = (api as any).documents.get;

/**
 * Editor header with article navigation arrows, bookmark, focus mode,
 * save status, and publish actions — matching the Seospace reference layout.
 */
export function AppHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const isEditorPage = pathname.startsWith("/editor/");
  const documentId = isEditorPage ? (pathname.split("/").pop() ?? "") : "";

  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [publishOpen, setPublishOpen] = useState(false);

  const {
    title,
    activeProjectId,
    isSaving,
    isDirty,
    lastSavedAt,
    sidebarOpen,
    toggleSidebar,
    toggleFocusMode,
  } = useEditorStore(
    useShallow((state) => ({
      title: state.title,
      activeProjectId: state.activeProjectId,
      isSaving: state.isSaving,
      isDirty: state.isDirty,
      lastSavedAt: state.lastSavedAt,
      sidebarOpen: state.sidebarOpen,
      toggleSidebar: state.toggleSidebar,
      toggleFocusMode: state.toggleFocusMode,
    })),
  );

  const project = useQuery(
    projectsGet,
    activeProjectId ? { projectId: activeProjectId as Id<"projects"> } : "skip",
  );

  // Fetch current document for bookmark state
  const document = useQuery(
    documentsGet,
    isEditorPage && documentId
      ? { documentId: documentId as Id<"documents"> }
      : "skip",
  );

  // Toggle bookmark mutation
  const toggleBookmark = useMutation(api.documents.toggleBookmark);

  const handleToggleBookmark = async () => {
    if (!documentId) return;
    try {
      const newState = await toggleBookmark({
        documentId: documentId as Id<"documents">,
      });
      toast.success(newState ? "Article bookmarked" : "Bookmark removed");
    } catch {
      toast.error("Failed to update bookmark");
    }
  };

  // Query documents list for article navigation
  const documents = useQuery(
    api.documents.list,
    activeProjectId && isEditorPage
      ? { projectId: activeProjectId as Id<"projects"> }
      : "skip",
  );

  // Article navigation: find current index and prev/next IDs
  const articleNav = useMemo(() => {
    if (!documents || !documentId) return null;
    const currentIndex = documents.findIndex((d) => d._id === documentId);
    if (currentIndex === -1) return null;
    return {
      current: currentIndex + 1,
      total: documents.length,
      prevId: currentIndex > 0 ? documents[currentIndex - 1]?._id : null,
      nextId:
        currentIndex < documents.length - 1
          ? documents[currentIndex + 1]?._id
          : null,
    };
  }, [documents, documentId]);

  const isBookmarked = document?.bookmarked === true;

  const saveStatusKey = isSaving
    ? "saving"
    : isDirty
      ? "dirty"
      : lastSavedAt
        ? "saved"
        : "idle";

  return (
    <TooltipProvider>
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-border/50 px-3">
        {/* ── Left section ── */}
        <div className="flex items-center gap-2">
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={toggleSidebar}
                  aria-label="Toggle sidebar"
                  className="text-muted-foreground hover:text-foreground"
                />
              }
            >
              <AnimatePresence mode="wait" initial={false}>
                {sidebarOpen ? (
                  <motion.div
                    key="close"
                    initial={{ opacity: 0, rotate: -90 }}
                    animate={{ opacity: 1, rotate: 0 }}
                    exit={{ opacity: 0, rotate: 90 }}
                    transition={{ duration: 0.15 }}
                  >
                    <PanelLeftClose className="size-4" />
                  </motion.div>
                ) : (
                  <motion.div
                    key="open"
                    initial={{ opacity: 0, rotate: 90 }}
                    animate={{ opacity: 1, rotate: 0 }}
                    exit={{ opacity: 0, rotate: -90 }}
                    transition={{ duration: 0.15 }}
                  >
                    <PanelLeftOpen className="size-4" />
                  </motion.div>
                )}
              </AnimatePresence>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              {sidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
            </TooltipContent>
          </Tooltip>

          {/* Article navigation — editor pages only */}
          {isEditorPage && articleNav && articleNav.total > 1 ? (
            <div className="flex items-center gap-1">
              <Tooltip>
                <TooltipTrigger
                  render={
                    <Button
                      variant="outline"
                      size="icon-sm"
                      disabled={!articleNav.prevId}
                      onClick={() =>
                        articleNav.prevId &&
                        router.push(`/editor/${articleNav.prevId}`)
                      }
                      className="text-muted-foreground"
                    />
                  }
                >
                  <ChevronLeft className="size-3.5" />
                </TooltipTrigger>
                <TooltipContent side="bottom">Previous article</TooltipContent>
              </Tooltip>

              <span className="min-w-[72px] text-center text-xs tabular-nums text-muted-foreground">
                {articleNav.current} of {articleNav.total}
              </span>

              <Tooltip>
                <TooltipTrigger
                  render={
                    <Button
                      variant="outline"
                      size="icon-sm"
                      disabled={!articleNav.nextId}
                      onClick={() =>
                        articleNav.nextId &&
                        router.push(`/editor/${articleNav.nextId}`)
                      }
                      className="text-muted-foreground"
                    />
                  }
                >
                  <ChevronRight className="size-3.5" />
                </TooltipTrigger>
                <TooltipContent side="bottom">Next article</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger
                  render={
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={toggleFocusMode}
                      className="ml-1 text-muted-foreground hover:text-foreground"
                    />
                  }
                >
                  <Maximize2 className="size-3.5" />
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  Focus mode (Esc to exit)
                </TooltipContent>
              </Tooltip>
            </div>
          ) : isEditorPage ? (
            /* Single doc: show breadcrumbs + focus button */
            <div className="flex items-center gap-2">
              <nav className="flex items-center gap-1 text-sm">
                {activeProjectId && project && (
                  <>
                    <Link
                      href={`/projects/${activeProjectId}`}
                      className="text-muted-foreground transition-colors hover:text-foreground"
                    >
                      {project.name}
                    </Link>
                    {title && (
                      <>
                        <ChevronRight className="size-3 text-muted-foreground/50" />
                        <span className="max-w-[200px] truncate font-medium text-foreground">
                          {title}
                        </span>
                      </>
                    )}
                  </>
                )}
              </nav>
              <Tooltip>
                <TooltipTrigger
                  render={
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={toggleFocusMode}
                      className="text-muted-foreground hover:text-foreground"
                    />
                  }
                >
                  <Maximize2 className="size-3.5" />
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  Focus mode (Esc to exit)
                </TooltipContent>
              </Tooltip>
            </div>
          ) : (
            /* Non-editor breadcrumbs */
            <nav className="flex items-center gap-1 text-sm">
              {activeProjectId && project ? (
                <>
                  <Link
                    href={`/projects/${activeProjectId}`}
                    className="text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {project.name}
                  </Link>
                </>
              ) : (
                <span className="font-medium text-foreground">
                  {pathname.startsWith("/dashboard")
                    ? "Dashboard"
                    : pathname.startsWith("/settings")
                      ? "Settings"
                      : pathname === "/projects" || pathname === "/projects/new"
                        ? "Projects"
                        : "Wryte"}
                </span>
              )}
            </nav>
          )}
        </div>

        {/* ── Right section ── */}
        {isEditorPage ? (
          <div className="flex items-center gap-1.5">
            {/* Save status */}
            <AnimatePresence mode="wait">
              {saveStatusKey === "saving" && (
                <motion.div
                  key="saving"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="mr-1 flex items-center gap-1.5 rounded-lg border border-border/50 bg-muted/40 px-2.5 py-1 text-xs text-muted-foreground"
                >
                  <Loader2 className="size-3 animate-spin" />
                  <span>Saving</span>
                </motion.div>
              )}
              {saveStatusKey === "dirty" && (
                <motion.div
                  key="dirty"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="mr-1 flex items-center gap-1.5 rounded-lg border border-border/50 bg-muted/40 px-2.5 py-1 text-xs text-muted-foreground"
                >
                  <Cloud className="size-3" />
                  <span>Unsaved</span>
                </motion.div>
              )}
              {saveStatusKey === "saved" && (
                <motion.div
                  key="saved"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="mr-1 flex items-center gap-1.5 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-xs text-emerald-600 dark:text-emerald-400"
                >
                  <CheckCircle2 className="size-3" />
                  <span>Saved</span>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Bookmark / Star */}
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => void handleToggleBookmark()}
                    className={cn(
                      "transition-colors",
                      isBookmarked
                        ? "text-amber-500 hover:text-amber-600"
                        : "text-muted-foreground hover:text-amber-500",
                    )}
                  />
                }
              >
                <Star
                  className="size-3.5"
                  fill={isBookmarked ? "currentColor" : "none"}
                />
              </TooltipTrigger>
              <TooltipContent side="bottom">
                {isBookmarked ? "Remove bookmark" : "Bookmark this article"}
              </TooltipContent>
            </Tooltip>

            {/* Schedule */}
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => setScheduleOpen(true)}
                    className="text-muted-foreground hover:text-foreground"
                  />
                }
              >
                <Calendar className="size-3.5" />
              </TooltipTrigger>
              <TooltipContent side="bottom">Schedule publish</TooltipContent>
            </Tooltip>

            {/* Publish button — prominent */}
            <Button
              size="sm"
              onClick={() => setPublishOpen(true)}
              className="ml-1 gap-1.5 rounded-lg px-4 font-medium shadow-sm"
            >
              <span className="text-xs">Publish</span>
            </Button>

            <ScheduleDialog
              open={scheduleOpen}
              onOpenChange={setScheduleOpen}
              documentId={documentId}
            />
            <PublishDialog
              open={publishOpen}
              onOpenChange={setPublishOpen}
              documentId={documentId}
              projectId={activeProjectId ?? ""}
            />
          </div>
        ) : null}
      </header>
    </TooltipProvider>
  );
}
