"use client";

import { cn } from "@wryte/logic/lib/utils";
import { useState } from "react";

type StatusCounts = {
  draft: number;
  review: number;
  ready: number;
  scheduled: number;
  published: number;
};

const SEGMENTS = [
  { key: "draft", label: "Draft", color: "bg-zinc-400 dark:bg-zinc-500" },
  { key: "review", label: "Review", color: "bg-amber-500" },
  { key: "ready", label: "Ready", color: "bg-blue-500" },
  { key: "scheduled", label: "Scheduled", color: "bg-purple-500" },
  { key: "published", label: "Published", color: "bg-emerald-500" },
] as const;

export function StatusDistribution({ counts }: { counts: StatusCounts }) {
  const [hovered, setHovered] = useState<string | null>(null);
  const total =
    counts.draft +
    counts.review +
    counts.ready +
    counts.scheduled +
    counts.published;

  if (total === 0) return null;

  const hoveredSegment = hovered
    ? SEGMENTS.find((s) => s.key === hovered)
    : null;
  const hoveredCount = hovered ? counts[hovered as keyof StatusCounts] : 0;

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/50">
          Status breakdown
        </h3>
        {hoveredSegment && (
          <span className="text-[11px] tabular-nums text-muted-foreground/60">
            {hoveredSegment.label} — {hoveredCount} article
            {hoveredCount !== 1 ? "s" : ""} (
            {Math.round((hoveredCount / total) * 100)}%)
          </span>
        )}
      </div>

      <div className="flex h-6 w-full overflow-hidden rounded-lg">
        {SEGMENTS.map((seg) => {
          const count = counts[seg.key];
          if (count === 0) return null;
          const pct = (count / total) * 100;
          return (
            <div
              key={seg.key}
              className={cn(
                "transition-opacity",
                seg.color,
                hovered && hovered !== seg.key ? "opacity-40" : "opacity-100",
              )}
              style={{ width: `${String(pct)}%` }}
              onMouseEnter={() => setHovered(seg.key)}
              onMouseLeave={() => setHovered(null)}
            />
          );
        })}
      </div>

      <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1">
        {SEGMENTS.map((seg) => {
          const count = counts[seg.key];
          if (count === 0) return null;
          return (
            <div
              key={seg.key}
              className="flex items-center gap-1.5"
              onMouseEnter={() => setHovered(seg.key)}
              onMouseLeave={() => setHovered(null)}
            >
              <span className={cn("size-2 rounded-full", seg.color)} />
              <span className="text-[11px] text-muted-foreground/60">
                {seg.label}
              </span>
              <span className="text-[11px] font-medium tabular-nums text-foreground/70">
                {count}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
