"use client";

import { useDraggable } from "@dnd-kit/core";
import { getColorClasses } from "@wryte/logic/lib/board-colors";
import { cn } from "@wryte/logic/lib/utils";
import type { CalendarDoc } from "@wryte/logic/stores/calendar-store";
import type { BoardColumnDef } from "@wryte/logic/types/board";
import { useRouter } from "next/navigation";

type CalendarDocCardProps = {
  document: CalendarDoc;
  columns: BoardColumnDef[];
  projectId: string;
  /** Date key this card lives on, or null if in the unscheduled panel. */
  sourceDate: string | null;
  /** Render as a static overlay clone (no drag hooks). */
  isOverlay?: boolean;
};

export function CalendarDocCard({
  document,
  columns,
  projectId: _projectId,
  sourceDate,
  isOverlay,
}: CalendarDocCardProps) {
  const router = useRouter();
  const isPublished = document.status === "published";

  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: document._id,
    data: { document, sourceDate },
    disabled: isPublished || isOverlay === true,
  });

  const col = columns.find((c) => c.id === document.status);
  const dotColor = col
    ? getColorClasses(col.color).dot
    : getColorClasses("gray").dot;

  return (
    <button
      ref={isOverlay ? undefined : setNodeRef}
      type="button"
      {...(isOverlay ? {} : { ...attributes, ...listeners })}
      onClick={(e) => {
        // Only navigate if not dragging
        if (!isDragging) {
          e.stopPropagation();
          router.push(`/editor/${document._id}`);
        }
      }}
      className={cn(
        "flex w-full items-center gap-1.5 rounded-md px-1.5 py-1 text-left text-[11px] leading-tight transition-all",
        "hover:bg-muted/80 group/card",
        isPublished && "cursor-default opacity-60",
        !isPublished && !isOverlay && "cursor-grab active:cursor-grabbing",
        isDragging && "opacity-30",
        isOverlay &&
          "rotate-2 scale-105 rounded-lg border bg-background/95 px-2 py-1.5 shadow-lg backdrop-blur-sm",
      )}
    >
      <span
        className={cn("size-1.5 shrink-0 rounded-full", dotColor)}
        aria-hidden
      />
      <span className="truncate font-medium text-foreground/80">
        {document.title || "Untitled"}
      </span>
    </button>
  );
}
