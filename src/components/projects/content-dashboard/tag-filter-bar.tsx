"use client";

import { Filter, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useBoardStore } from "@/stores/board-store";

/**
 * Deterministic color palette — mirrors tag-badges.tsx so colors are
 * consistent between card badges and filter bar pills.
 */
const TAG_COLORS = [
  {
    base: "border-blue-200 text-blue-700 dark:border-blue-800 dark:text-blue-300",
    active:
      "bg-blue-500/20 border-blue-400 text-blue-800 dark:bg-blue-500/30 dark:border-blue-500 dark:text-blue-200",
  },
  {
    base: "border-emerald-200 text-emerald-700 dark:border-emerald-800 dark:text-emerald-300",
    active:
      "bg-emerald-500/20 border-emerald-400 text-emerald-800 dark:bg-emerald-500/30 dark:border-emerald-500 dark:text-emerald-200",
  },
  {
    base: "border-purple-200 text-purple-700 dark:border-purple-800 dark:text-purple-300",
    active:
      "bg-purple-500/20 border-purple-400 text-purple-800 dark:bg-purple-500/30 dark:border-purple-500 dark:text-purple-200",
  },
  {
    base: "border-amber-200 text-amber-700 dark:border-amber-800 dark:text-amber-300",
    active:
      "bg-amber-500/20 border-amber-400 text-amber-800 dark:bg-amber-500/30 dark:border-amber-500 dark:text-amber-200",
  },
  {
    base: "border-pink-200 text-pink-700 dark:border-pink-800 dark:text-pink-300",
    active:
      "bg-pink-500/20 border-pink-400 text-pink-800 dark:bg-pink-500/30 dark:border-pink-500 dark:text-pink-200",
  },
  {
    base: "border-cyan-200 text-cyan-700 dark:border-cyan-800 dark:text-cyan-300",
    active:
      "bg-cyan-500/20 border-cyan-400 text-cyan-800 dark:bg-cyan-500/30 dark:border-cyan-500 dark:text-cyan-200",
  },
  {
    base: "border-orange-200 text-orange-700 dark:border-orange-800 dark:text-orange-300",
    active:
      "bg-orange-500/20 border-orange-400 text-orange-800 dark:bg-orange-500/30 dark:border-orange-500 dark:text-orange-200",
  },
  {
    base: "border-indigo-200 text-indigo-700 dark:border-indigo-800 dark:text-indigo-300",
    active:
      "bg-indigo-500/20 border-indigo-400 text-indigo-800 dark:bg-indigo-500/30 dark:border-indigo-500 dark:text-indigo-200",
  },
];

function hashTag(tag: string): number {
  let hash = 0;
  for (let i = 0; i < tag.length; i++) {
    hash = (hash << 5) - hash + tag.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

interface TagFilterBarProps {
  /** All unique tags across all content items */
  allTags: string[];
}

export function TagFilterBar({ allTags }: TagFilterBarProps) {
  const { activeTagFilters, toggleTagFilter, clearTagFilters } = useBoardStore();

  if (allTags.length === 0) return null;

  const hasActiveFilters = activeTagFilters.size > 0;

  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-1">
      <Filter className="size-3.5 shrink-0 text-muted-foreground" />

      <div className="flex items-center gap-1.5">
        {allTags.map((tag) => {
          const isActive = activeTagFilters.has(tag);
          const palette = TAG_COLORS[hashTag(tag) % TAG_COLORS.length]!;

          return (
            <button
              key={tag}
              type="button"
              onClick={() => toggleTagFilter(tag)}
              className={cn(
                "inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-[11px] font-medium transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                isActive ? palette.active : palette.base,
              )}
            >
              {tag}
            </button>
          );
        })}
      </div>

      {hasActiveFilters && (
        <button
          type="button"
          onClick={clearTagFilters}
          className="inline-flex shrink-0 items-center gap-1 rounded-full border border-border px-2 py-0.5 text-[11px] text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <X className="size-3" />
          Clear
        </button>
      )}
    </div>
  );
}
