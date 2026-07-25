"use client";

import {
  DAYS,
  getDaysInMonth,
  getFirstDayOfMonth,
  isBeforeToday,
  isSameDay,
  MONTHS,
} from "@wryte/logic/lib/calendar-utils";
import { cn } from "@wryte/logic/lib/utils";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useCallback, useState } from "react";

type InlineCalendarProps = {
  selected: Date | null;
  onSelect: (date: Date) => void;
  /** Earliest selectable date. Defaults to today. */
  minDate?: Date;
  /** Optional array of dates to highlight as selected (e.g. for range display). */
  selectedDates?: Date[];
};

export function InlineCalendar({
  selected,
  onSelect,
  minDate,
  selectedDates,
}: InlineCalendarProps) {
  const today = new Date();
  const effectiveMin = minDate ?? today;
  const [viewYear, setViewYear] = useState(
    selected?.getFullYear() ?? today.getFullYear(),
  );
  const [viewMonth, setViewMonth] = useState(
    selected?.getMonth() ?? today.getMonth(),
  );

  const daysInMonth = getDaysInMonth(viewYear, viewMonth);
  const firstDay = getFirstDayOfMonth(viewYear, viewMonth);

  const prevMonth = useCallback(() => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  }, [viewMonth]);

  const nextMonth = useCallback(() => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  }, [viewMonth]);

  // Can't go to previous month if it's before the minimum month
  const canGoPrev =
    viewYear > effectiveMin.getFullYear() ||
    (viewYear === effectiveMin.getFullYear() &&
      viewMonth > effectiveMin.getMonth());

  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  return (
    <div>
      {/* Month/year header */}
      <div className="mb-3 flex items-center justify-between">
        <button
          type="button"
          onClick={prevMonth}
          disabled={!canGoPrev}
          className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-30"
        >
          <ChevronLeft className="size-4" />
        </button>
        <span className="text-sm font-medium">
          {MONTHS[viewMonth]} {viewYear}
        </span>
        <button
          type="button"
          onClick={nextMonth}
          className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <ChevronRight className="size-4" />
        </button>
      </div>

      {/* Day labels */}
      <div className="mb-1 grid grid-cols-7 gap-0.5">
        {DAYS.map((d) => (
          <div
            key={d}
            className="flex h-8 items-center justify-center text-[11px] font-medium text-muted-foreground/60"
          >
            {d}
          </div>
        ))}
      </div>

      {/* Day grid */}
      <div className="grid grid-cols-7 gap-0.5">
        {cells.map((cell, i) => {
          if (cell === null) {
            return <div key={`empty-${String(i)}`} className="h-8" />;
          }

          const date = new Date(viewYear, viewMonth, cell);
          const disabled = isBeforeToday(date);
          const isSelected = selected && isSameDay(date, selected);
          const isToday = isSameDay(date, today);
          const isSelectedRange =
            !isSelected && selectedDates?.some((d) => isSameDay(date, d));

          return (
            <button
              key={cell}
              type="button"
              disabled={disabled}
              onClick={() => onSelect(date)}
              className={cn(
                "flex h-8 items-center justify-center rounded-md text-[13px] transition-all",
                disabled && "pointer-events-none text-muted-foreground/25",
                !disabled && !isSelected && "text-foreground hover:bg-muted",
                isToday && !isSelected && "font-semibold text-primary",
                isSelected &&
                  "bg-primary text-primary-foreground font-medium shadow-sm",
                isSelectedRange && "bg-primary/10 text-primary font-medium",
              )}
            >
              {cell}
            </button>
          );
        })}
      </div>
    </div>
  );
}
