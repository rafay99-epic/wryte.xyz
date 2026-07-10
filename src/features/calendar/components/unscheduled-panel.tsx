"use client";

import { useDroppable } from "@dnd-kit/core";
import { motion } from "framer-motion";
import {
  CalendarPlus,
  PanelRightClose,
  PanelRightOpen,
  Search,
} from "lucide-react";
import { useMemo } from "react";
import { Input } from "@/components/ui/input";
import { getColorClasses } from "@/lib/board-colors";
import { cn } from "@/lib/utils";
import type { CalendarDoc } from "@/stores/calendar-store";
import { useCalendarStore } from "@/stores/calendar-store";
import type { BoardColumnDef } from "@/types/board";
import { CalendarDocCard } from "./calendar-doc-card";

/** Statuses that should appear in the unscheduled panel. */
const UNSCHEDULED_STATUSES = ["draft", "review", "ready"];

type UnscheduledPanelProps = {
  documents: CalendarDoc[];
  columns: BoardColumnDef[];
  projectId: string;
};

export function UnscheduledPanel({
  documents,
  columns,
  projectId,
}: UnscheduledPanelProps) {
  const {
    unscheduledPanelOpen,
    unscheduledSearch,
    unscheduledStatusFilter,
    toggleUnscheduledPanel,
    setUnscheduledSearch,
    toggleStatusFilter,
    activeDocument,
  } = useCalendarStore();

  // The panel doubles as a drop target: dragging a SCHEDULED article onto it
  // cancels the schedule (the reverse of dragging out to a date). Only one of
  // the two branches below is mounted at a time, so a single droppable id
  // serves both the open panel and the collapsed strip.
  const { setNodeRef, isOver } = useDroppable({ id: "unscheduled-zone" });
  const unscheduleDropActive = isOver && activeDocument?.status === "scheduled";

  const filtered = useMemo(() => {
    let result = documents.filter(
      (d) =>
        UNSCHEDULED_STATUSES.includes(d.status) && d.scheduledAt === undefined,
    );

    // Status filter
    if (unscheduledStatusFilter.size > 0) {
      result = result.filter((d) => unscheduledStatusFilter.has(d.status));
    }

    // Search filter
    if (unscheduledSearch.trim()) {
      const q = unscheduledSearch.toLowerCase();
      result = result.filter((d) => d.title.toLowerCase().includes(q));
    }

    // Sort by most recently updated
    return result.sort((a, b) => b.updatedAt - a.updatedAt);
  }, [documents, unscheduledStatusFilter, unscheduledSearch]);

  // Collapse toggle button (always visible)
  if (!unscheduledPanelOpen) {
    return (
      <button
        ref={setNodeRef}
        type="button"
        onClick={toggleUnscheduledPanel}
        className={cn(
          "flex h-full w-10 flex-col items-center justify-center gap-2 border-l bg-muted/20 text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground",
          unscheduleDropActive && "bg-primary/10 text-primary",
        )}
        title="Show unscheduled articles"
      >
        <PanelRightOpen className="size-4" />
        {filtered.length > 0 && (
          <span className="flex size-5 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">
            {filtered.length}
          </span>
        )}
      </button>
    );
  }

  return (
    <motion.div
      ref={setNodeRef}
      initial={{ width: 0, opacity: 0 }}
      animate={{ width: 280, opacity: 1 }}
      exit={{ width: 0, opacity: 0 }}
      transition={{ duration: 0.2 }}
      className={cn(
        "flex h-full w-[280px] shrink-0 flex-col border-l bg-muted/10 transition-colors",
        unscheduleDropActive &&
          "bg-primary/5 ring-1 ring-inset ring-primary/40",
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b px-3 py-2.5">
        <div className="flex items-center gap-2">
          <CalendarPlus className="size-3.5 text-muted-foreground" />
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">
            Unscheduled
          </h3>
          <span className="flex size-4 items-center justify-center rounded-full bg-muted text-[10px] font-bold text-muted-foreground">
            {filtered.length}
          </span>
        </div>
        <button
          type="button"
          onClick={toggleUnscheduledPanel}
          className="flex size-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          title="Hide panel"
        >
          <PanelRightClose className="size-3.5" />
        </button>
      </div>

      {/* Search */}
      <div className="border-b px-3 py-2">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 size-3 -translate-y-1/2 text-muted-foreground/50" />
          <Input
            value={unscheduledSearch}
            onChange={(e) => setUnscheduledSearch(e.target.value)}
            placeholder="Search articles..."
            className="h-7 pl-7 text-xs"
          />
        </div>
      </div>

      {/* Status filter chips */}
      <div className="flex gap-1 border-b px-3 py-2">
        {UNSCHEDULED_STATUSES.map((status) => {
          const col = columns.find((c) => c.id === status);
          const colors = col
            ? getColorClasses(col.color)
            : getColorClasses("gray");
          const isActive = unscheduledStatusFilter.has(status);
          return (
            <button
              key={status}
              type="button"
              onClick={() => toggleStatusFilter(status)}
              className={cn(
                "flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium capitalize transition-all",
                isActive
                  ? colors.badge
                  : "bg-muted/60 text-muted-foreground hover:bg-muted",
              )}
            >
              <span className={cn("size-1.5 rounded-full", colors.dot)} />
              {status}
            </button>
          );
        })}
      </div>

      {/* Document list */}
      <div className="flex-1 overflow-y-auto px-2 py-2">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <CalendarPlus className="mb-2 size-8 text-muted-foreground/30" />
            <p className="text-xs text-muted-foreground/60">
              {documents.length === 0
                ? "No articles yet"
                : "No unscheduled articles match your filters"}
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-0.5">
            {filtered.map((doc) => (
              <CalendarDocCard
                key={doc._id}
                document={doc}
                columns={columns}
                projectId={projectId}
                sourceDate={null}
              />
            ))}
          </div>
        )}
      </div>

      {/* Hint */}
      <div className="border-t px-3 py-2">
        <p className="text-[10px] text-muted-foreground/40">
          Drag articles onto the calendar to schedule them
        </p>
      </div>
    </motion.div>
  );
}
