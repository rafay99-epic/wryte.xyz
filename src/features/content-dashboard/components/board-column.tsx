"use client";

import { useDroppable } from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { motion } from "framer-motion";
import { ChevronDown, ChevronUp, Clock, Plus, Upload } from "lucide-react";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getColorClasses } from "@/lib/board-colors";
import { staggerContainer } from "@/lib/motion";
import type { ParsedFrontmatter } from "@/lib/parse-frontmatter";
import { cn } from "@/lib/utils";
import { useBoardStore } from "@/stores/board-store";
import type { BoardColumnDef } from "@/types/board";
import { BoardCard } from "./board-card";
import type { ContentItem } from "./content-table-row";

/** Number of cards shown per page in a single column. */
const COLUMN_PAGE_SIZE = 8;

type BoardColumnProps = {
  column: BoardColumnDef;
  items: ContentItem[];
  columns: BoardColumnDef[];
  frontmatterMap: Map<string, ParsedFrontmatter>;
  allProjectTags: string[];
  selectedPaths?: Set<string> | undefined;
  onToggleSelect?: ((path: string, checked: boolean) => void) | undefined;
  onOpenItem: (item: ContentItem) => void;
  onDeleteLocal: (item: ContentItem) => void;
  onDeleteRemote: (item: ContentItem) => void;
  onCreateClick: (initialStatus: string) => void;
  /** When true, this column is read-only (e.g. remote column). */
  readOnly?: boolean | undefined;
};

export function BoardColumn({
  column,
  items,
  columns,
  frontmatterMap,
  allProjectTags,
  selectedPaths,
  onToggleSelect,
  onOpenItem,
  onDeleteLocal,
  onDeleteRemote,
  onCreateClick,
  readOnly,
}: BoardColumnProps) {
  const colors = getColorClasses(column.color);
  const overColumnId = useBoardStore((s) => s.overColumnId);
  const isOver = overColumnId === column.id;

  // Per-column pagination
  const [currentPage, setCurrentPage] = useState(1);
  const totalItems = items.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / COLUMN_PAGE_SIZE));

  // Clamp page if items shrink
  const effectivePage = Math.min(currentPage, totalPages);
  if (effectivePage !== currentPage && currentPage > 1) {
    // Can't call setState in render, so schedule it
    setTimeout(() => setCurrentPage(effectivePage), 0);
  }

  const paginatedItems = useMemo(() => {
    const start = (effectivePage - 1) * COLUMN_PAGE_SIZE;
    return items.slice(start, start + COLUMN_PAGE_SIZE);
  }, [items, effectivePage]);

  const { setNodeRef } = useDroppable({
    id: `column-${column.id}`,
    data: { columnId: column.id },
  });

  const itemIds = useMemo(
    () =>
      paginatedItems
        .map((i) => i.id)
        .filter((id): id is NonNullable<typeof id> => id != null),
    [paginatedItems],
  );

  const showingStart = (effectivePage - 1) * COLUMN_PAGE_SIZE + 1;
  const showingEnd = Math.min(effectivePage * COLUMN_PAGE_SIZE, totalItems);

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex min-w-[280px] max-w-[340px] flex-1 flex-col rounded-xl border border-t-[3px] bg-muted/20 transition-colors",
        colors.accent,
        isOver && "border-primary/40 bg-primary/5",
      )}
    >
      {/* Column header */}
      <div className="flex items-center justify-between px-3 py-2.5">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold">{column.label}</span>
          {column.behavior === "schedule" && (
            <Clock className="size-3 text-muted-foreground/60" />
          )}
          {column.behavior === "publish" && (
            <Upload className="size-3 text-muted-foreground/60" />
          )}
          <Badge
            variant="secondary"
            className={cn(
              "px-1.5 py-0 text-[10px] font-semibold",
              colors.badge,
            )}
          >
            {totalItems}
          </Badge>
        </div>
      </div>

      {/* Cards */}
      <div className="flex-1 overflow-y-auto px-2 pb-2 slim-scrollbar">
        <SortableContext items={itemIds} strategy={verticalListSortingStrategy}>
          <motion.div
            variants={staggerContainer}
            initial="initial"
            animate="animate"
            className="flex flex-col gap-2"
          >
            {paginatedItems.length === 0 ? (
              <p className="py-6 text-center text-xs text-muted-foreground/50">
                No articles
              </p>
            ) : (
              paginatedItems.map((item) => {
                const fm = item.id ? frontmatterMap.get(item.id) : undefined;
                return (
                  <BoardCard
                    key={item.kind === "local" ? item.id : item.path}
                    item={item}
                    tags={fm?.tags ?? item.tags ?? []}
                    columnId={column.id}
                    columns={columns}
                    allProjectTags={allProjectTags}
                    selected={
                      item.kind === "remote" && selectedPaths
                        ? selectedPaths.has(item.path)
                        : undefined
                    }
                    onSelect={
                      item.kind === "remote" && onToggleSelect
                        ? (checked) => onToggleSelect(item.path, checked)
                        : undefined
                    }
                    onOpen={() => onOpenItem(item)}
                    onDelete={
                      item.kind === "local" && item.id
                        ? () => onDeleteLocal(item)
                        : undefined
                    }
                    onDeleteRemote={
                      item.kind === "remote" && item.sha
                        ? () => onDeleteRemote(item)
                        : undefined
                    }
                  />
                );
              })
            )}
          </motion.div>
        </SortableContext>
      </div>

      {/* Pagination controls — only shown when column has more than one page */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t px-3 py-1.5">
          <p className="text-[10px] text-muted-foreground">
            {showingStart}–{showingEnd} of {totalItems}
          </p>
          <div className="flex items-center gap-0.5">
            <Button
              variant="ghost"
              size="icon-xs"
              disabled={effectivePage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              aria-label="Previous page"
            >
              <ChevronUp className="size-3.5" />
            </Button>
            <span className="min-w-8 text-center text-[10px] tabular-nums text-muted-foreground">
              {effectivePage}/{totalPages}
            </span>
            <Button
              variant="ghost"
              size="icon-xs"
              disabled={effectivePage >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              aria-label="Next page"
            >
              <ChevronDown className="size-3.5" />
            </Button>
          </div>
        </div>
      )}

      {/* Footer — new article */}
      {!readOnly && (
        <div className="border-t px-2 py-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onCreateClick(column.id)}
            className="w-full justify-start gap-1.5 text-muted-foreground"
          >
            <Plus className="size-3.5" />
            New article
          </Button>
        </div>
      )}
    </div>
  );
}
