"use client";

import { useDroppable } from "@dnd-kit/core";
import { cn } from "@wryte/logic/lib/utils";
import type { CalendarDoc } from "@wryte/logic/stores/calendar-store";
import type { BoardColumnDef } from "@wryte/logic/types/board";
import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import { CalendarDocCard } from "./calendar-doc-card";

const MAX_VISIBLE = 3;

type CalendarCellProps = {
  dateKey: string;
  day: number;
  documents: CalendarDoc[];
  columns: BoardColumnDef[];
  projectId: string;
  isToday: boolean;
  isPast: boolean;
  isCurrentMonth: boolean;
};

export function CalendarCell({
  dateKey,
  day,
  documents,
  columns,
  projectId,
  isToday,
  isPast,
  isCurrentMonth,
}: CalendarCellProps) {
  const [expanded, setExpanded] = useState(false);

  const { setNodeRef, isOver } = useDroppable({
    id: `date-${dateKey}`,
    disabled: isPast,
    data: { dateKey },
  });

  const overflow = documents.length - MAX_VISIBLE;
  const visible = expanded ? documents : documents.slice(0, MAX_VISIBLE);

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "relative flex min-h-[100px] flex-col gap-0.5 border-b border-r p-1 transition-all",
        !isCurrentMonth && "bg-muted/20 opacity-40",
        isCurrentMonth && "bg-background",
        isPast && isCurrentMonth && "opacity-50",
        isOver && !isPast && "ring-2 ring-inset ring-primary/40 bg-primary/5",
        isToday && "ring-2 ring-inset ring-primary/60",
      )}
    >
      {/* Day number */}
      <span
        className={cn(
          "mb-0.5 inline-flex size-6 items-center justify-center rounded-full text-xs font-medium",
          isToday && "bg-primary text-primary-foreground",
          !isToday && isCurrentMonth && "text-foreground/70",
          !isCurrentMonth && "text-muted-foreground/50",
        )}
      >
        {day}
      </span>

      {/* Document cards */}
      <div className="flex flex-1 flex-col gap-0.5">
        <AnimatePresence initial={false}>
          {visible.map((doc) => (
            <motion.div
              key={doc._id}
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.15 }}
            >
              <CalendarDocCard
                document={doc}
                columns={columns}
                projectId={projectId}
                sourceDate={dateKey}
              />
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Overflow indicator */}
        {overflow > 0 && !expanded && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setExpanded(true);
            }}
            className="mt-0.5 rounded px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            +{overflow} more
          </button>
        )}
        {expanded && overflow > 0 && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setExpanded(false);
            }}
            className="mt-0.5 rounded px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            Show less
          </button>
        )}
      </div>
    </div>
  );
}
