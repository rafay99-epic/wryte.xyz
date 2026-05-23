"use client";

import { Check } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

export function ActivityChart({
  data,
  dailyWordGoal,
}: {
  data: Array<{ date: string; words: number }>;
  dailyWordGoal?: number | null;
}) {
  const [hovered, setHovered] = useState<number | null>(null);

  const padded = padTo30(data);
  const maxWords = Math.max(1, ...padded.map((d) => d.words));
  const hasGoal =
    dailyWordGoal !== null && dailyWordGoal !== undefined && dailyWordGoal > 0;
  const goalsMet = hasGoal
    ? padded.filter((d) => d.words >= dailyWordGoal).length
    : 0;
  const goalLinePct = hasGoal
    ? Math.min((dailyWordGoal / maxWords) * 100, 100)
    : 0;

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/50">
          30-day activity
        </h3>
        <div className="flex items-center gap-3">
          {hasGoal && (
            <span className="flex items-center gap-1 text-[11px] tabular-nums text-muted-foreground/50">
              <Check className="size-3 text-emerald-500" />
              {goalsMet}/30 goals met
            </span>
          )}
          {hovered !== null && padded[hovered] && (
            <span className="text-[11px] tabular-nums text-muted-foreground/60">
              {formatDate(padded[hovered].date)} —{" "}
              {padded[hovered].words.toLocaleString()} words
            </span>
          )}
        </div>
      </div>

      <div className="relative flex items-end gap-[3px]" style={{ height: 64 }}>
        {hasGoal && goalLinePct < 100 && (
          <div
            className="pointer-events-none absolute left-0 right-0 border-t border-dashed border-emerald-500/30"
            style={{ bottom: `${String(goalLinePct)}%` }}
          />
        )}

        {padded.map((entry, i) => {
          const pct = (entry.words / maxWords) * 100;
          const isToday = i === padded.length - 1;
          const metGoal = hasGoal && entry.words >= dailyWordGoal;

          return (
            <div
              key={entry.date}
              className="relative flex-1"
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)}
            >
              <div
                className={cn(
                  "w-full rounded-sm transition-colors",
                  entry.words === 0
                    ? "bg-muted/30"
                    : metGoal
                      ? hovered === i
                        ? "bg-emerald-400"
                        : "bg-emerald-500/60"
                      : hovered === i
                        ? "bg-primary"
                        : isToday
                          ? "bg-primary/80"
                          : "bg-primary/40",
                )}
                style={{
                  height: entry.words === 0 ? 2 : Math.max(4, (pct / 100) * 64),
                }}
              />
              {metGoal && (
                <div className="absolute -top-1 left-1/2 size-1.5 -translate-x-1/2 rounded-full bg-emerald-500" />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function localYMD(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${String(y)}-${m}-${d}`;
}

function padTo30(
  data: Array<{ date: string; words: number }>,
): Array<{ date: string; words: number }> {
  const map = new Map(data.map((d) => [d.date, d.words]));
  const result: Array<{ date: string; words: number }> = [];
  const now = new Date();
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const key = localYMD(d);
    result.push({ date: key, words: map.get(key) ?? 0 });
  }
  return result;
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
