"use client";

import { useMutation, useQuery } from "convex/react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Cloud,
  History,
  Loader2,
  Maximize2,
  PanelLeftClose,
  PanelLeftOpen,
  Share2,
  Star,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useShallow } from "zustand/react/shallow";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { DeleteDocumentDialog } from "@/features/content-dashboard/components/delete-document-dialog";
import { PublishDialog } from "@/features/editor/components/publish-dialog";
import { ScheduleDialog } from "@/features/editor/components/schedule-dialog";
import { ShareLinkDialog } from "@/features/editor/components/share-link-dialog";
import { getColorClasses } from "@/lib/board-colors";
import { cn } from "@/lib/utils";
import { useEditorStore } from "@/stores/editor-store";
import { type BoardColumnDef, DEFAULT_BOARD_COLUMNS } from "@/types/board";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

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
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);

  const {
    title,
    activeProjectId,
    isSaving,
    isDirty,
    lastSavedAt,
    sidebarOpen,
    toggleSidebar,
    toggleFocusMode,
    historyPanelOpen,
    toggleHistoryPanel,
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
      historyPanelOpen: state.historyPanelOpen,
      toggleHistoryPanel: state.toggleHistoryPanel,
    })),
  );

  const project = useQuery(
    api.cms.projects.get,
    activeProjectId ? { projectId: activeProjectId as Id<"projects"> } : "skip",
  );

  // Fetch current document for bookmark state
  const document = useQuery(
    api.cms.documents.get,
    isEditorPage && documentId
      ? { documentId: documentId as Id<"documents"> }
      : "skip",
  );

  // Board columns for status selector
  const boardColumns = useQuery(
    api.cms.boardColumns.getColumns,
    activeProjectId ? { projectId: activeProjectId as Id<"projects"> } : "skip",
  ) as BoardColumnDef[] | undefined;
  const columns = boardColumns ?? DEFAULT_BOARD_COLUMNS;

  // Publish history for count display
  const publishHistory = useQuery(
    api.cms.documents.getPublishHistory,
    isEditorPage && documentId
      ? { documentId: documentId as Id<"documents"> }
      : "skip",
  );
  const publishCount = publishHistory?.length ?? 0;

  // Toggle bookmark mutation
  const toggleBookmark = useMutation(api.cms.documents.toggleBookmark);

  // Status mutation
  const updateStatus = useMutation(api.cms.documents.updateStatus);

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
    api.cms.documents.list,
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

  const handleStatusChange = async (newStatus: string) => {
    if (!documentId || !document) return;
    if (document.status === newStatus) return;
    try {
      await updateStatus({
        documentId: documentId as Id<"documents">,
        status: newStatus,
      });
      const label = columns.find((c) => c.id === newStatus)?.label ?? newStatus;
      toast.success(`Status changed to "${label}"`);
    } catch {
      toast.error("Failed to update status");
    }
  };

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
                <Link
                  href={`/projects/${activeProjectId}`}
                  className="text-muted-foreground transition-colors hover:text-foreground"
                >
                  {project.name}
                </Link>
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

            {/* Publish History */}
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={toggleHistoryPanel}
                    className={cn(
                      "relative text-muted-foreground hover:text-foreground",
                      historyPanelOpen && "bg-muted text-foreground",
                    )}
                  />
                }
              >
                <History className="size-3.5" />
                {publishCount > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 flex size-3.5 items-center justify-center rounded-full bg-primary text-[8px] font-bold text-primary-foreground">
                    {publishCount > 9 ? "9+" : publishCount}
                  </span>
                )}
              </TooltipTrigger>
              <TooltipContent side="bottom">
                {publishCount > 0
                  ? `Published ${publishCount} ${publishCount === 1 ? "time" : "times"}`
                  : "Publish history"}
              </TooltipContent>
            </Tooltip>

            {/* Status selector */}
            {document && (
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <button
                      type="button"
                      className="mr-1 flex items-center gap-1.5 rounded-lg border border-border/50 px-2.5 py-1 text-xs transition-colors hover:bg-muted/60"
                    />
                  }
                >
                  <span
                    className={cn(
                      "size-2 rounded-full",
                      getColorClasses(
                        columns.find((c) => c.id === document.status)?.color ??
                          "gray",
                      ).dot,
                    )}
                  />
                  <span className="font-medium text-foreground/80">
                    {columns.find((c) => c.id === document.status)?.label ??
                      document.status}
                  </span>
                  <ChevronDown className="size-3 text-muted-foreground/60" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="min-w-[160px]">
                  {columns.map((col) => {
                    const isActive = document.status === col.id;
                    const colors = getColorClasses(col.color);
                    return (
                      <DropdownMenuItem
                        key={col.id}
                        onClick={() => void handleStatusChange(col.id)}
                        className={cn(
                          "gap-2",
                          isActive && "bg-accent font-medium",
                        )}
                      >
                        <span
                          className={cn("size-2 rounded-full", colors.dot)}
                        />
                        {col.label}
                        {isActive && (
                          <CheckCircle2 className="ml-auto size-3 text-primary" />
                        )}
                      </DropdownMenuItem>
                    );
                  })}
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            {/* Share preview link */}
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => setShareOpen(true)}
                    className="text-muted-foreground hover:text-foreground"
                  />
                }
              >
                <Share2 className="size-3.5" />
              </TooltipTrigger>
              <TooltipContent side="bottom">Share preview</TooltipContent>
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

            {/* Delete — soft-deletes to project trash. Disabled until the
                document query loads so we don't open the dialog without
                title/github coordinates. */}
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    disabled={!document}
                    onClick={() => setDeleteOpen(true)}
                    className="text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                  />
                }
              >
                <Trash2 className="size-3.5" />
              </TooltipTrigger>
              <TooltipContent side="bottom">Move to trash</TooltipContent>
            </Tooltip>

            {/* Publish button — prominent */}
            <Button
              size="sm"
              onClick={() => setPublishOpen(true)}
              className="ml-1 gap-1.5 rounded-lg px-4 font-medium shadow-sm"
            >
              <span className="text-xs">Publish</span>
            </Button>

            <ShareLinkDialog
              open={shareOpen}
              onOpenChange={setShareOpen}
              documentId={documentId}
            />

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
            {document && activeProjectId && (
              <DeleteDocumentDialog
                target={(() => {
                  const t: {
                    documentId: Id<"documents">;
                    title: string;
                    githubPath?: string;
                    githubSha?: string;
                  } = {
                    documentId: documentId as Id<"documents">,
                    title: document.title,
                  };
                  if (document.githubPath) t.githubPath = document.githubPath;
                  if (document.githubSha) t.githubSha = document.githubSha;
                  return t;
                })()}
                projectId={activeProjectId as Id<"projects">}
                open={deleteOpen}
                onOpenChange={setDeleteOpen}
                onDeleted={() => {
                  // Navigate back to the project before the reactive `get`
                  // query returns null and the editor flashes its 404.
                  router.push(`/projects/${activeProjectId}`);
                }}
              />
            )}
          </div>
        ) : null}
      </header>
    </TooltipProvider>
  );
}
