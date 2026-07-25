"use client";

import { api } from "@wryte/backend/_generated/api";
import type { Id } from "@wryte/backend/_generated/dataModel";
import { useCalendarStore } from "@wryte/logic/stores/calendar-store";
import {
  type BoardColumnDef,
  DEFAULT_BOARD_COLUMNS,
} from "@wryte/logic/types/board";
import { Skeleton } from "@wryte/ui/skeleton";
import { useQuery } from "convex/react";
import { useEffect } from "react";
import { CalendarView } from "@/features/calendar/components/calendar-view";

type CalendarSurfaceProps = {
  projectId: string;
};

/**
 * Self-contained calendar: fetches its own data and renders the month grid +
 * unscheduled panel. Shared by the dedicated calendar route and the content
 * dashboard's calendar view mode — mount it only while visible, so its
 * subscriptions (calendar list, board columns) never ride along with the
 * table/board views.
 */
export function CalendarSurface({ projectId }: CalendarSurfaceProps) {
  const project = useQuery(api.cms.projects.get, {
    projectId: projectId as Id<"projects">,
  });
  const documents = useQuery(api.cms.documents.listForCalendar, {
    projectId: projectId as Id<"projects">,
  });
  const boardColumns = useQuery(api.cms.boardColumns.getColumns, {
    projectId: projectId as Id<"projects">,
  }) as BoardColumnDef[] | undefined;

  // Month position, drag state, and panel filters are calendar-only —
  // clear them whenever the calendar leaves the screen (route change OR
  // dashboard view-mode switch).
  useEffect(() => {
    return () => {
      useCalendarStore.getState().reset();
    };
  }, []);

  if (project === undefined || documents === undefined) {
    return (
      <div
        className="flex h-full flex-col gap-4"
        data-testid="calendar-loading"
      >
        <div className="grid flex-1 grid-cols-7 gap-px">
          {Array.from({ length: 35 }).map((_, i) => (
            <Skeleton key={`skel-${String(i)}`} className="min-h-[80px]" />
          ))}
        </div>
      </div>
    );
  }

  if (project === null) return null;

  const columns = boardColumns ?? DEFAULT_BOARD_COLUMNS;

  return (
    <div className="flex h-full flex-col" data-testid="calendar-surface">
      <CalendarView
        documents={documents ?? []}
        columns={columns}
        projectId={projectId}
        timezone={project.timezone}
      />
    </div>
  );
}
