"use client";

import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  DragOverlay,
  type DragStartEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { AnimatePresence } from "framer-motion";
import { useCallback, useMemo } from "react";
import { toast } from "sonner";
import { getDateKey, isBeforeToday, parseDateKey } from "@/lib/calendar-utils";
import type { CalendarDoc } from "@/stores/calendar-store";
import { useCalendarStore } from "@/stores/calendar-store";
import type { BoardColumnDef } from "@/types/board";
import { CalendarDocCard } from "./calendar-doc-card";
import { CalendarGrid } from "./calendar-grid";
import { ScheduleTimePopover } from "./schedule-time-popover";
import { UnscheduledPanel } from "./unscheduled-panel";

interface CalendarViewProps {
  documents: CalendarDoc[];
  columns: BoardColumnDef[];
  projectId: string;
}

export function CalendarView({
  documents,
  columns,
  projectId,
}: CalendarViewProps) {
  const { activeDocument, setActiveDocument, setPendingDrop, pendingDrop } =
    useCalendarStore();

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    }),
    useSensor(KeyboardSensor),
  );

  // Group documents by date for the calendar grid
  const documentsByDate = useMemo(() => {
    const map = new Map<string, CalendarDoc[]>();

    for (const doc of documents) {
      let dateKey: string | null = null;

      if (doc.status === "scheduled" && doc.scheduledAt) {
        dateKey = getDateKey(new Date(doc.scheduledAt));
      } else if (doc.status === "published" && doc.publishedAt) {
        dateKey = getDateKey(new Date(doc.publishedAt));
      }

      if (dateKey) {
        const existing = map.get(dateKey) ?? [];
        existing.push(doc);
        map.set(dateKey, existing);
      }
    }

    // Sort within each date by scheduledAt/publishedAt time
    for (const [, docs] of map) {
      docs.sort((a, b) => {
        const aTime = a.scheduledAt ?? a.publishedAt ?? 0;
        const bTime = b.scheduledAt ?? b.publishedAt ?? 0;
        return aTime - bTime;
      });
    }

    return map;
  }, [documents]);

  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      const data = event.active.data.current;
      const doc = data?.["document"] as CalendarDoc | undefined;
      setActiveDocument(doc ?? null);
    },
    [setActiveDocument],
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      setActiveDocument(null);

      const { active, over } = event;
      if (!over || !active.data.current) return;

      const doc = active.data.current["document"] as CalendarDoc;
      const overId = String(over.id);

      // Only accept drops on date cells (id format: "date-YYYY-MM-DD")
      if (!overId.startsWith("date-")) return;
      const targetDateKey = overId.replace("date-", "");

      // Reject published documents
      if (doc.status === "published") {
        toast.error("Published articles can't be rescheduled");
        return;
      }

      // Reject past dates (double-check — droppable should also be disabled)
      const targetDate = parseDateKey(targetDateKey);
      if (isBeforeToday(targetDate)) {
        toast.error("Can't schedule to a past date");
        return;
      }

      // If the doc is already scheduled on the same date, skip
      const sourceDate = active.data.current["sourceDate"] as string | null;
      if (sourceDate === targetDateKey) return;

      // Determine existing time if rescheduling
      const pendingDropData: {
        documentId: string;
        targetDate: string;
        existingHour?: number;
        existingMinute?: number;
      } = {
        documentId: doc._id,
        targetDate: targetDateKey,
      };

      if (doc.scheduledAt) {
        const existing = new Date(doc.scheduledAt);
        pendingDropData.existingHour = existing.getHours();
        pendingDropData.existingMinute = existing.getMinutes();
      }

      setPendingDrop(pendingDropData);
    },
    [setActiveDocument, setPendingDrop],
  );

  return (
    <div className="flex h-full overflow-hidden">
      {/* Calendar grid */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <CalendarGrid
          documentsByDate={documentsByDate}
          columns={columns}
          projectId={projectId}
        />

        <UnscheduledPanel
          documents={documents}
          columns={columns}
          projectId={projectId}
        />

        {/* Drag overlay */}
        <DragOverlay dropAnimation={null}>
          {activeDocument ? (
            <CalendarDocCard
              document={activeDocument}
              columns={columns}
              projectId={projectId}
              sourceDate={null}
              isOverlay
            />
          ) : null}
        </DragOverlay>
      </DndContext>

      {/* Time picker popover */}
      <AnimatePresence>
        {pendingDrop && <ScheduleTimePopover />}
      </AnimatePresence>
    </div>
  );
}
