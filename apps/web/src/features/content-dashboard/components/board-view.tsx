"use client";

import {
  DndContext,
  type DragEndEvent,
  type DragOverEvent,
  DragOverlay,
  type DragStartEvent,
  KeyboardSensor,
  PointerSensor,
  rectIntersection,
  TouchSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { api } from "@wryte/backend/_generated/api";
import type { Id } from "@wryte/backend/_generated/dataModel";
import type { ParsedFrontmatter } from "@wryte/logic/lib/parse-frontmatter";
import { useBoardStore } from "@wryte/logic/stores/board-store";
import type { BoardColumnDef } from "@wryte/logic/types/board";
import { Button } from "@wryte/ui/button";
import { useAction, useMutation } from "convex/react";
import { Plus } from "lucide-react";
import { useCallback, useMemo } from "react";
import { toast } from "sonner";
import { useShallow } from "zustand/react/shallow";
import { useBoardKeyboardNav } from "@/features/content-dashboard/hooks/use-board-keyboard-nav";
import { BoardCard } from "./board-card";
import { BoardColumn } from "./board-column";
import type { ContentItem } from "./content-table-row";

const REMOTE_COLUMN: BoardColumnDef = {
  id: "remote",
  label: "Remote",
  color: "blue",
  behavior: "none",
  position: 9999,
};

type BoardViewProps = {
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
  selectedDocIds?: Set<string> | undefined;
  onToggleDocSelect?: ((docId: string, checked: boolean) => void) | undefined;
  /** True when any card is selected — enables Notion-style selection mode. */
  selectionActive?: boolean | undefined;
};

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
  selectedDocIds,
  onToggleDocSelect,
  selectionActive,
}: BoardViewProps) {
  // Pull exactly the slice this view cares about. A bare `useBoardStore()`
  // would subscribe to every field — focusedCardId, draggedItem, overColumnId,
  // settingsDialog, etc. — and re-render the whole board on every nudge.
  const {
    activeItem,
    optimisticMoves,
    setActiveItem,
    setOverColumnId,
    applyOptimisticMove,
    clearOptimisticMove,
    setPendingSchedule,
  } = useBoardStore(
    useShallow((s) => ({
      activeItem: s.activeItem,
      optimisticMoves: s.optimisticMoves,
      setActiveItem: s.setActiveItem,
      setOverColumnId: s.setOverColumnId,
      applyOptimisticMove: s.applyOptimisticMove,
      clearOptimisticMove: s.clearOptimisticMove,
      setPendingSchedule: s.setPendingSchedule,
    })),
  );

  const moveCard = useMutation(api.cms.documents.moveCard);
  const publishAction = useAction(api.integrations.github.publish);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 150, tolerance: 8 },
    }),
    useSensor(KeyboardSensor),
  );

  const grouped = useMemo(() => {
    const groups: Record<string, ContentItem[]> = {};

    for (const col of columns) {
      groups[col.id] = [];
    }
    groups["remote"] = [];

    for (const item of items) {
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
        const firstCol = columns[0]?.id ?? "draft";
        if (!groups[firstCol]) groups[firstCol] = [];
        groups[firstCol]?.push(item);
      }
    }

    for (const key of Object.keys(groups)) {
      groups[key]?.sort(
        (a, b) => (a.boardPosition ?? 0) - (b.boardPosition ?? 0),
      );
    }

    return groups;
  }, [items, columns, optimisticMoves]);

  // --- Keyboard navigation (vim-style) ---
  useBoardKeyboardNav({ columns, grouped, items, onOpenItem });

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

      let targetColumnId: string;
      const overData = over.data.current;

      if (overData?.["columnId"]) {
        targetColumnId = overData["columnId"] as string;
      } else if (overData?.["sortable"]) {
        targetColumnId = (overData["columnId"] as string) ?? sourceColumnId;
      } else {
        return;
      }

      if (!draggedItem.id) return;
      if (targetColumnId === "remote") return;

      const targetItems = grouped[targetColumnId] ?? [];
      const overItemId = over.id as string;

      let newPosition: number;

      if (targetItems.length === 0) {
        newPosition = 1000;
      } else if (overItemId && overItemId !== String(active.id)) {
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
      } else {
        const lastPos =
          targetItems.length > 0
            ? (targetItems[targetItems.length - 1]?.boardPosition ?? 0)
            : 0;
        newPosition = lastPos + 1000;
      }

      applyOptimisticMove(draggedItem.id, targetColumnId, newPosition);

      try {
        const result = await moveCard({
          documentId: draggedItem.id as Id<"documents">,
          targetStatus: targetColumnId,
          boardPosition: newPosition,
        });

        clearOptimisticMove(draggedItem.id);

        if (result.behavior === "publish" && hasGithub) {
          try {
            await publishAction({
              documentId: draggedItem.id as Id<"documents">,
            });
            toast.success(`Published "${draggedItem.title}" to GitHub`);
          } catch (err) {
            try {
              await moveCard({
                documentId: draggedItem.id as Id<"documents">,
                targetStatus: sourceColumnId,
                boardPosition: draggedItem.boardPosition ?? 0,
              });
            } catch {
              // Best-effort revert
            }
            toast.error(
              err instanceof Error ? err.message : "Failed to publish",
            );
          }
        } else if (result.behavior === "schedule") {
          setPendingSchedule(draggedItem.id, sourceColumnId);
        }
      } catch (_err) {
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

  const activeItemTags = useMemo(() => {
    if (!activeItem?.id) return [];
    const fm = frontmatterMap.get(activeItem.id);
    return fm?.tags ?? activeItem.tags ?? [];
  }, [activeItem, frontmatterMap]);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={rectIntersection}
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
            selectedDocIds={selectedDocIds}
            onToggleDocSelect={onToggleDocSelect}
            selectionActive={selectionActive}
            onOpenItem={onOpenItem}
            onDeleteLocal={onDeleteLocal}
            onDeleteRemote={onDeleteRemote}
            onCreateClick={(status) => onCreateClick(status)}
          />
        ))}

        {hasGithub && (grouped["remote"]?.length ?? 0) > 0 && (
          <BoardColumn
            column={REMOTE_COLUMN}
            items={grouped["remote"] ?? []}
            columns={columns}
            frontmatterMap={frontmatterMap}
            allProjectTags={allProjectTags}
            selectedPaths={selectedPaths}
            onToggleSelect={onToggleSelect}
            selectionActive={selectionActive}
            onOpenItem={onOpenItem}
            onDeleteLocal={onDeleteLocal}
            onDeleteRemote={onDeleteRemote}
            onCreateClick={(status) => onCreateClick(status)}
            readOnly
          />
        )}

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
