"use client";

import { useQuery } from "convex/react";
import { motion } from "framer-motion";
import { CalendarDays } from "lucide-react";
import { useParams } from "next/navigation";
import { useEffect } from "react";
import { CalendarView } from "@/components/projects/calendar/calendar-view";
import { Skeleton } from "@/components/ui/skeleton";
import { fadeSlideUp, smoothTransition } from "@/lib/motion";
import { useCalendarStore } from "@/stores/calendar-store";
import { useEditorStore } from "@/stores/editor-store";
import { DEFAULT_BOARD_COLUMNS } from "@/types/board";
import { api } from "../../../../../../convex/_generated/api";
import type { Id } from "../../../../../../convex/_generated/dataModel";

// biome-ignore lint/suspicious/noExplicitAny: api types are generated at build time via `npx convex dev`
const projectsGet = (api as any).projects.get;
// biome-ignore lint/suspicious/noExplicitAny: api types are generated at build time via `npx convex dev`
const documentsListForCalendar = (api as any).documents.listForCalendar;
// biome-ignore lint/suspicious/noExplicitAny: api types are generated at build time via `npx convex dev`
const boardColumnsGetColumns = (api as any).boardColumns.getColumns;

export default function CalendarPage() {
  const params = useParams<{ projectId: string }>();
  const projectId = params.projectId as Id<"projects">;

  const project = useQuery(projectsGet, { projectId });
  const documents = useQuery(documentsListForCalendar, { projectId });
  const boardColumns = useQuery(boardColumnsGetColumns, { projectId });

  // Set active project in sidebar
  useEffect(() => {
    useEditorStore.getState().setActiveProjectId(projectId);
  }, [projectId]);

  // Reset calendar store on unmount
  useEffect(() => {
    return () => {
      useCalendarStore.getState().reset();
    };
  }, []);

  // Loading
  if (project === undefined || documents === undefined) {
    return (
      <div className="flex h-full flex-col gap-4 p-6">
        <div className="flex items-center gap-3">
          <Skeleton className="size-8 rounded-lg" />
          <Skeleton className="h-6 w-48" />
        </div>
        <div className="grid flex-1 grid-cols-7 gap-px">
          {Array.from({ length: 35 }).map((_, i) => (
            <Skeleton key={`skel-${String(i)}`} className="min-h-[80px]" />
          ))}
        </div>
      </div>
    );
  }

  // Not found
  if (project === null) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <motion.div
          variants={fadeSlideUp}
          initial="initial"
          animate="animate"
          transition={smoothTransition}
          className="text-center"
        >
          <CalendarDays className="mx-auto mb-3 size-10 text-muted-foreground/30" />
          <h2 className="mb-1 text-lg font-bold text-foreground">
            Project not found
          </h2>
          <p className="text-sm text-muted-foreground">
            This project doesn&apos;t exist or may have been deleted.
          </p>
        </motion.div>
      </div>
    );
  }

  const columns = boardColumns ?? DEFAULT_BOARD_COLUMNS;

  return (
    <div className="flex h-full flex-col">
      <CalendarView
        documents={documents ?? []}
        columns={columns}
        projectId={projectId}
        timezone={project.timezone}
      />
    </div>
  );
}
