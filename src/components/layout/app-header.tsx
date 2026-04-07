"use client";

import { useQuery } from "convex/react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Calendar,
  CheckCircle2,
  ChevronRight,
  Cloud,
  Loader2,
  PanelLeftClose,
  PanelLeftOpen,
  Send,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
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
import { useEditorStore } from "@/stores/editor-store";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

// biome-ignore lint/suspicious/noExplicitAny: api types are generated at build time via `npx convex dev`
const projectsGet = (api as any).projects.get;

/**
 * Redesigned minimal header with:
 *  - Animated sidebar toggle
 *  - Compact breadcrumbs with chevron separator
 *  - Animated save status indicator with icons
 *  - Publish/Schedule as compact icon+text buttons
 */
export function AppHeader() {
  const pathname = usePathname();
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
  } = useEditorStore(
    useShallow((state) => ({
      title: state.title,
      activeProjectId: state.activeProjectId,
      isSaving: state.isSaving,
      isDirty: state.isDirty,
      lastSavedAt: state.lastSavedAt,
      sidebarOpen: state.sidebarOpen,
      toggleSidebar: state.toggleSidebar,
    })),
  );

  const project = useQuery(
    projectsGet,
    activeProjectId ? { projectId: activeProjectId as Id<"projects"> } : "skip",
  );

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
        {/* Left: toggle + breadcrumbs */}
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

          {/* Breadcrumbs */}
          <nav className="flex items-center gap-1 text-sm">
            {activeProjectId && project ? (
              <>
                <Link
                  href={`/projects/${activeProjectId}`}
                  className="text-muted-foreground transition-colors hover:text-foreground"
                >
                  {project.name}
                </Link>
                {isEditorPage && title && (
                  <>
                    <ChevronRight className="size-3 text-muted-foreground/50" />
                    <span className="max-w-[200px] truncate font-medium text-foreground">
                      {title}
                    </span>
                  </>
                )}
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
        </div>

        {/* Center: save status */}
        {isEditorPage && (
          <div className="absolute left-1/2 -translate-x-1/2">
            <AnimatePresence mode="wait">
              {saveStatusKey === "saving" && (
                <motion.div
                  key="saving"
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 4 }}
                  className="flex items-center gap-1.5 text-xs text-muted-foreground"
                >
                  <Loader2 className="size-3 animate-spin" />
                  <span>Saving</span>
                </motion.div>
              )}
              {saveStatusKey === "dirty" && (
                <motion.div
                  key="dirty"
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 4 }}
                  className="flex items-center gap-1.5 text-xs text-muted-foreground"
                >
                  <Cloud className="size-3 pulse-subtle" />
                  <span>Unsaved</span>
                </motion.div>
              )}
              {saveStatusKey === "saved" && (
                <motion.div
                  key="saved"
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 4 }}
                  className="flex items-center gap-1.5 text-xs text-muted-foreground"
                >
                  <CheckCircle2 className="size-3 text-emerald-500" />
                  <span>Saved</span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* Right: editor actions */}
        {isEditorPage && (
          <div className="flex items-center gap-1.5">
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setScheduleOpen(true)}
                    className="gap-1.5 text-muted-foreground hover:text-foreground"
                  />
                }
              >
                <Calendar className="size-3.5" />
                <span className="hidden sm:inline text-xs">Schedule</span>
              </TooltipTrigger>
              <TooltipContent side="bottom">Schedule publish</TooltipContent>
            </Tooltip>

            <Button
              size="sm"
              onClick={() => setPublishOpen(true)}
              className="gap-1.5 shadow-sm"
            >
              <Send className="size-3.5" />
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
        )}
      </header>
    </TooltipProvider>
  );
}
