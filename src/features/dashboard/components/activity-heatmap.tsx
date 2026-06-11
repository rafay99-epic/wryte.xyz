"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";

type DayCell = {
  date: string;
  words: number;
  /** False for leading pad days before the window starts. */
  inRange: boolean;
  isFuture: boolean;
};

const WEEKS = 12;
const DAY_LABELS = ["", "Mon", "", "Wed", "", "Fri", ""];

/**
 * GitHub-style writing heatmap: one cell per day, 12 weeks, intensity
 * scaled to the user's own busiest day. Fed entirely by the
 * `recentActivity` array already on `writing_stats` — zero extra queries.
 */
export function ActivityHeatmap({
  data,
}: {
  data: Array<{ date: string; words: number }>;
}) {
  const [hovered, setHovered] = useState<DayCell | null>(null);

  const weeks = useMemo(() => buildWeeks(data), [data]);
  const maxWords = useMemo(
    () =>
      Math.max(
        1,
        ...weeks.flat().map((cell) => (cell.inRange ? cell.words : 0)),
      ),
    [weeks],
  );

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/50">
          Writing heatmap
        </h3>
        {hovered?.inRange && !hovered.isFuture && (
          <span className="text-[11px] tabular-nums text-muted-foreground/60">
            {formatDate(hovered.date)} — {hovered.words.toLocaleString()} words
          </span>
        )}
      </div>

      <div className="flex gap-2">
        {/* Weekday gutter */}
        <div className="grid grid-rows-7 gap-[3px]">
          {["sun", "mon", "tue", "wed", "thu", "fri", "sat"].map((day, i) => (
            <span
              key={day}
              className="flex h-3 items-center text-[9px] leading-none text-muted-foreground/40"
            >
              {DAY_LABELS[i]}
            </span>
          ))}
        </div>

        {/* Week columns */}
        <div className="flex gap-[3px]">
          {weeks.map((week) => (
            <div key={week[0]?.date} className="grid grid-rows-7 gap-[3px]">
              {week.map((cell) => (
                <div
                  key={cell.date}
                  onMouseEnter={() => setHovered(cell)}
                  onMouseLeave={() => setHovered(null)}
                  className={cn(
                    "size-3 rounded-[3px]",
                    !cell.inRange || cell.isFuture
                      ? "bg-transparent"
                      : levelClass(cell.words, maxWords),
                  )}
                />
              ))}
            </div>
          ))}
        </div>

        {/* Legend */}
        <div className="ml-auto flex items-end gap-1 pb-px">
          <span className="text-[9px] text-muted-foreground/40">Less</span>
          {[0, 1, 2, 3, 4].map((level) => (
            <div
              key={level}
              className={cn("size-3 rounded-[3px]", LEVEL_CLASSES[level])}
            />
          ))}
          <span className="text-[9px] text-muted-foreground/40">More</span>
        </div>
      </div>
    </div>
  );
}

const LEVEL_CLASSES = [
  "bg-muted/40",
  "bg-primary/25",
  "bg-primary/45",
  "bg-primary/70",
  "bg-primary",
] as const;

function levelClass(words: number, max: number): string {
  if (words <= 0) return LEVEL_CLASSES[0];
  const level = Math.min(4, Math.max(1, Math.ceil((words / max) * 4)));
  return LEVEL_CLASSES[level] as string;
}

function localYMD(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${String(y)}-${m}-${d}`;
}

/**
 * Builds WEEKS columns of 7 cells, aligned so each column starts on
 * Sunday and the last column contains today. Trailing cells after today
 * are marked `isFuture`; cells before the window are `inRange: false`.
 */
function buildWeeks(data: Array<{ date: string; words: number }>): DayCell[][] {
  const byDate = new Map(data.map((d) => [d.date, d.words]));
  const today = new Date();
  const todayKey = localYMD(today);

  // Last column's Sunday, then back (WEEKS - 1) more weeks.
  const start = new Date(today);
  start.setDate(start.getDate() - start.getDay() - (WEEKS - 1) * 7);
  const windowStart = new Date(today);
  windowStart.setDate(windowStart.getDate() - (WEEKS * 7 - 1));
  const windowStartKey = localYMD(windowStart);

  const weeks: DayCell[][] = [];
  const cursor = new Date(start);
  for (let w = 0; w < WEEKS; w++) {
    const week: DayCell[] = [];
    for (let d = 0; d < 7; d++) {
      const key = localYMD(cursor);
      week.push({
        date: key,
        words: byDate.get(key) ?? 0,
        inRange: key >= windowStartKey,
        isFuture: key > todayKey,
      });
      cursor.setDate(cursor.getDate() + 1);
    }
    weeks.push(week);
  }
  return weeks;
}

function formatDate(ymd: string): string {
  const [, m, d] = ymd.split("-");
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  return `${months[Number(m) - 1]} ${Number(d)}`;
}
