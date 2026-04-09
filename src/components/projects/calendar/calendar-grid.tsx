"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import {
  DAYS,
  getDateKey,
  getDaysInMonth,
  getFirstDayOfMonth,
  isBeforeToday,
  isSameDay,
  MONTHS,
} from "@/lib/calendar-utils";
import { smoothTransition } from "@/lib/motion";
import type { CalendarDoc } from "@/stores/calendar-store";
import { useCalendarStore } from "@/stores/calendar-store";
import type { BoardColumnDef } from "@/types/board";
import { CalendarCell } from "./calendar-cell";

interface CalendarGridProps {
  documentsByDate: Map<string, CalendarDoc[]>;
  columns: BoardColumnDef[];
  projectId: string;
}

export function CalendarGrid({
  documentsByDate,
  columns,
  projectId,
}: CalendarGridProps) {
  const { viewYear, viewMonth, goNextMonth, goPrevMonth, goToToday } =
    useCalendarStore();

  const today = useMemo(() => new Date(), []);

  const isCurrentMonthView =
    viewYear === today.getFullYear() && viewMonth === today.getMonth();

  // Build the cell data for the current month view
  const cells = useMemo(() => {
    const daysInMonth = getDaysInMonth(viewYear, viewMonth);
    const firstDay = getFirstDayOfMonth(viewYear, viewMonth);

    const result: Array<{
      key: string;
      day: number;
      dateKey: string;
      isCurrentMonth: boolean;
      isToday: boolean;
      isPast: boolean;
    }> = [];

    // Previous month padding
    if (firstDay > 0) {
      const prevMonth = viewMonth === 0 ? 11 : viewMonth - 1;
      const prevYear = viewMonth === 0 ? viewYear - 1 : viewYear;
      const prevDays = getDaysInMonth(prevYear, prevMonth);
      for (let i = firstDay - 1; i >= 0; i--) {
        const day = prevDays - i;
        const date = new Date(prevYear, prevMonth, day);
        const dateKey = getDateKey(date);
        result.push({
          key: `prev-${dateKey}`,
          day,
          dateKey,
          isCurrentMonth: false,
          isToday: isSameDay(date, today),
          isPast: isBeforeToday(date),
        });
      }
    }

    // Current month
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(viewYear, viewMonth, day);
      const dateKey = getDateKey(date);
      result.push({
        key: dateKey,
        day,
        dateKey,
        isCurrentMonth: true,
        isToday: isSameDay(date, today),
        isPast: isBeforeToday(date),
      });
    }

    // Next month padding — fill up to complete the last row
    const remaining = result.length % 7 === 0 ? 0 : 7 - (result.length % 7);
    if (remaining > 0) {
      const nextMonth = viewMonth === 11 ? 0 : viewMonth + 1;
      const nextYear = viewMonth === 11 ? viewYear + 1 : viewYear;
      for (let day = 1; day <= remaining; day++) {
        const date = new Date(nextYear, nextMonth, day);
        const dateKey = getDateKey(date);
        result.push({
          key: `next-${dateKey}`,
          day,
          dateKey,
          isCurrentMonth: false,
          isToday: isSameDay(date, today),
          isPast: isBeforeToday(date),
        });
      }
    }

    return result;
  }, [viewYear, viewMonth, today]);

  return (
    <div className="flex flex-1 flex-col overflow-hidden rounded-lg border">
      {/* Month navigation header */}
      <div className="flex items-center justify-between border-b bg-muted/30 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={goPrevMonth}
            className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <ChevronLeft className="size-4" />
          </button>
          <button
            type="button"
            onClick={goNextMonth}
            className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <ChevronRight className="size-4" />
          </button>
          <h2 className="text-sm font-semibold">
            {MONTHS[viewMonth]} {viewYear}
          </h2>
        </div>

        {!isCurrentMonthView && (
          <Button variant="outline" size="sm" onClick={goToToday}>
            Today
          </Button>
        )}
      </div>

      {/* Day-of-week header */}
      <div className="grid grid-cols-7 border-b bg-muted/20">
        {DAYS.map((d) => (
          <div
            key={d}
            className="border-r px-2 py-1.5 text-center text-[11px] font-medium text-muted-foreground/60 last:border-r-0"
          >
            {d}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <AnimatePresence mode="wait">
        <motion.div
          key={`${viewYear}-${viewMonth}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={smoothTransition}
          className="grid flex-1 grid-cols-7"
        >
          {cells.map((cell) => (
            <CalendarCell
              key={cell.key}
              dateKey={cell.dateKey}
              day={cell.day}
              documents={documentsByDate.get(cell.dateKey) ?? []}
              columns={columns}
              projectId={projectId}
              isToday={cell.isToday}
              isPast={cell.isPast}
              isCurrentMonth={cell.isCurrentMonth}
            />
          ))}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
