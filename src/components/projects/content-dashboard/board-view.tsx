"use client";

import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  type DragOverEvent,
  DragOverlay,
  type DragStartEvent,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { useAction, useMutation } from "convex/react";
import { Plus } from "lucide-react";
import { useCallback, useMemo } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { ParsedFrontmatter } from "@/lib/parse-frontmatter";
import { useBoardStore } from "@/stores/board-store";
import type { BoardColumnDef } from "@/types/board";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { BoardCard } from "./board-card";
import { BoardColumn } from "./board-column";
import type { ContentItem } from "./content-table-row";

/** Pseudo-column for remote GitHub files. */
const REMOTE_COLUMN: BoardColumnDef = {
  id: "remote",
  label: "Remote",
  color: "blue",
  behavior: "none",
  position: 9999,
};

interface BoardViewProps {
  items: ContentItem[];
  columns: BoardColumnDef[];
  frontmatterMap: Map<string, ParsedFrontmatter>;
  hasGithub: boolean;
  projectId: string;
  selectedPaths: Set<string>;
  onToggleSelect: (path: string, checked: boolean) => void;
  onOpenItem: (item: ContentItem) => void;
  onDeleteLocal: (item: ContentItem) => void;
  onDeleteRemote: (item: ContentItem) => void;
  onCreateClick: (initialStatus?: string) => void;
  onSettingsClick: () => void;
}

export function BoardView({
  items,
  columns,
  frontmatterMap,
  hasGithub,
  projectId: _projectId,
  selectedPaths,
  onToggleSelect,
  onOpenItem,
  onDeleteLocal,
  onDeleteRemote,
  onCreateClick,
  onSettingsClick,
}: BoardViewProps) {
  const {
    activeItem,
    optimisticMoves,
    setActiveItem,
    setOverColumnId,
    applyOptimisticMove,
    clearOptimisticMove,
    setPendingSchedule,
  } = useBoardStore();

  const moveCard = useMutation(api.cms.documents.moveCard);

  const publishAction = useAction(api.integrations.github.publish);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 12 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 220, tolerance: 8 },
    }),
    useSensor(KeyboardSensor),
  );

  // Group items by status, applying optimistic moves
  const grouped = useMemo(() => {
    const groups: Record<string, ContentItem[]> = {};

    // Initialize groups for all columns
    for (const col of columns) {
      groups[col.id] = [];
    }
    groups["remote"] = [];

    for (const item of items) {
      // Check for optimistic move
      const optimistic = item.id ? optimisticMoves.get(item.id) : undefined;
      const effectiveStatus = optimistic?.status ?? item.status;
      const effectivePosition = optimistic?.boardPosition ?? item.boardPosition;

      if (item.kind === "remote") {
        groups["remote"]?.push(item);
      } else if (effectiveStatus && groups[effectiveStatus]) {
        const updated: ContentItem = {
          ...item,
          status: effectiveStatus,
        };
        if (effectivePosition !== undefined) {
          updated.boardPosition = effectivePosition;
        }
        groups[effectiveStatus]?.push(updated);
      } else {
        // Fallback: items without status go to first column
        const firstCol = columns[0]?.id ?? "draft";
        if (!groups[firstCol]) groups[firstCol] = [];
        groups[firstCol]?.push(item);
      }
    }

    // Sort each group by boardPosition
    for (const key of Object.keys(groups)) {
      groups[key]?.sort(
        (a, b) => (a.boardPosition ?? 0) - (b.boardPosition ?? 0),
      );
    }

    return groups;
  }, [items, columns, optimisticMoves]);

  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      const data = event.active.data.current;
      const item = data?.["item"] as ContentItem | undefined;
      setActiveItem(item ?? null);
    },
    [setActiveItem],
  );

  const handleDragOver = useCallback(
    (event: DragOverEvent) => {
      const overData = event.over?.data.current;
      if (overData?.["columnId"]) {
        setOverColumnId(overData["columnId"] as string);
      } else if (overData?.["sortable"]) {
        // Over another card — extract column from its data
        setOverColumnId(null);
      } else {
        setOverColumnId(null);
      }
    },
    [setOverColumnId],
  );

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      setActiveItem(null);
      setOverColumnId(null);

      const { active, over } = event;
      if (!over || !active.data.current) return;

      const activeData = active.data.current;
      const draggedItem = activeData["item"] as ContentItem;
      const sourceColumnId = activeData["columnId"] as string;

      // Determine target column
      let targetColumnId: string;
      const overData = over.data.current;

      if (overData?.["columnId"]) {
        // Dropped on a column droppable
        targetColumnId = overData["columnId"] as string;
      } else if (overData?.["sortable"]) {
        // Dropped on another card — find its column
        targetColumnId = (overData["columnId"] as string) ?? sourceColumnId;
      } else {
        return; // Invalid drop target
      }

      if (!draggedItem.id) return;

      // Compute new board position via fractional indexing
      const targetItems = grouped[targetColumnId] ?? [];
      const overItemId = over.id as string;

      let newPosition: number;

      if (targetColumnId !== sourceColumnId || targetItems.length === 0) {
        // Moving to different column or empty column — place at end
        const lastPos =
          targetItems.length > 0
            ? (targetItems[targetItems.length - 1]?.boardPosition ?? 0)
            : 0;
        newPosition = lastPos + 1000;
      } else {
        // Reordering within same column
        const overIndex = targetItems.findIndex((i) => i.id === overItemId);
        if (overIndex === -1) {
          newPosition =
            (targetItems[targetItems.length - 1]?.boardPosition ?? 0) + 1000;
        } else if (overIndex === 0) {
          newPosition = (targetItems[0]?.boardPosition ?? 0) - 1000;
        } else {
          const prev = targetItems[overIndex - 1]?.boardPosition ?? 0;
          const curr = targetItems[overIndex]?.boardPosition ?? 0;
          newPosition = (prev + curr) / 2;
        }
      }

      // Apply optimistic move
      applyOptimisticMove(draggedItem.id, targetColumnId, newPosition);

      try {
        const result = await moveCard({
          documentId: draggedItem.id as Id<"documents">,
          targetStatus: targetColumnId,
          boardPosition: newPosition,
        });

        // Clear optimistic move — Convex reactive query will have updated
        clearOptimisticMove(draggedItem.id);

        // Handle column behavior
        if (result.behavior === "publish" && hasGithub) {
          try {
            await publishAction({
              documentId: draggedItem.id as Id<"documents">,
            });
            toast.success(`Published "${draggedItem.title}" to GitHub`);
          } catch (err) {
            toast.error(
              err instanceof Error ? err.message : "Failed to publish",
            );
          }
        } else if (result.behavior === "schedule") {
          setPendingSchedule(draggedItem.id, sourceColumnId);
        }
      } catch (_err) {
        // Revert optimistic move
        clearOptimisticMove(draggedItem.id);
        toast.error("Failed to move card");
      }
    },
    [
      grouped,
      hasGithub,
      moveCard,
      publishAction,
      setActiveItem,
      setOverColumnId,
      applyOptimisticMove,
      clearOptimisticMove,
      setPendingSchedule,
    ],
  );

  // Compute all unique tags across items for tag autocomplete
  const allProjectTags = useMemo(() => {
    const tagSet = new Set<string>();
    for (const item of items) {
      for (const tag of item.tags ?? []) {
        tagSet.add(tag);
      }
      if (item.id) {
        const fm = frontmatterMap.get(item.id);
        if (fm?.tags) {
          for (const tag of fm.tags) {
            tagSet.add(tag);
          }
        }
      }
    }
    return Array.from(tagSet).sort();
  }, [items, frontmatterMap]);

  // Find tags for the active item (for drag overlay)
  const activeItemTags = useMemo(() => {
    if (!activeItem?.id) return [];
    const fm = frontmatterMap.get(activeItem.id);
    return fm?.tags ?? activeItem.tags ?? [];
  }, [activeItem, frontmatterMap]);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className="flex flex-col gap-4 pb-4 md:flex-row md:overflow-x-auto">
        {columns.map((col) => (
          <BoardColumn
            key={col.id}
            column={col}
            items={grouped[col.id] ?? []}
            columns={columns}
            frontmatterMap={frontmatterMap}
            allProjectTags={allProjectTags}
            onOpenItem={onOpenItem}
            onDeleteLocal={onDeleteLocal}
            onDeleteRemote={onDeleteRemote}
            onCreateClick={(status) => onCreateClick(status)}
          />
        ))}

        {/* Remote column — only shown when GitHub is connected and has remote items */}
        {hasGithub && (grouped["remote"]?.length ?? 0) > 0 && (
          <BoardColumn
            column={REMOTE_COLUMN}
            items={grouped["remote"] ?? []}
            columns={columns}
            frontmatterMap={frontmatterMap}
            allProjectTags={allProjectTags}
            selectedPaths={selectedPaths}
            onToggleSelect={onToggleSelect}
            onOpenItem={onOpenItem}
            onDeleteLocal={onDeleteLocal}
            onDeleteRemote={onDeleteRemote}
            onCreateClick={(status) => onCreateClick(status)}
            readOnly
          />
        )}

        {/* Add column button */}
        <div className="flex min-w-[80px] items-start pt-2">
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={onSettingsClick}
            className="text-muted-foreground hover:text-foreground"
            title="Customize columns"
          >
            <Plus className="size-4" />
          </Button>
        </div>
      </div>

      {/* Drag overlay */}
      <DragOverlay>
        {activeItem && (
          <BoardCard
            item={activeItem}
            tags={activeItemTags}
            columnId=""
            onOpen={() => {}}
            isOverlay
          />
        )}
      </DragOverlay>
    </DndContext>
  );
}
