"use client";

import { Filter, X } from "lucide-react";
import { useShallow } from "zustand/react/shallow";
import { getTagColor } from "@/lib/tag-colors";
import { cn } from "@/lib/utils";
import { useBoardStore } from "@/stores/board-store";

type TagFilterBarProps = {
  /** All unique tags across all content items */
  allTags: string[];
};

export function TagFilterBar({ allTags }: TagFilterBarProps) {
  // Subscribe to only the slice this bar needs — a bare `useBoardStore()` would
  // re-render on every board state change (drag, focus, dialog toggles).
  const { activeTagFilters, toggleTagFilter, clearTagFilters } = useBoardStore(
    useShallow((s) => ({
      activeTagFilters: s.activeTagFilters,
      toggleTagFilter: s.toggleTagFilter,
      clearTagFilters: s.clearTagFilters,
    })),
  );

  if (allTags.length === 0) return null;

  const hasActiveFilters = activeTagFilters.size > 0;

  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-1">
      <Filter className="size-3.5 shrink-0 text-muted-foreground/50" />

      <div className="flex items-center gap-1.5">
        {allTags.map((tag) => {
          const isActive = activeTagFilters.has(tag);
          const palette = getTagColor(tag);

          return (
            <button
              key={tag}
              type="button"
              onClick={() => toggleTagFilter(tag)}
              className={cn(
                "inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-[11px] font-medium transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                isActive
                  ? palette.active
                  : "border-border/40 text-muted-foreground/60 hover:border-border/60 hover:text-muted-foreground",
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
