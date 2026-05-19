"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Check,
  Copy,
  FileText,
  MoreHorizontal,
  Pencil,
  Tag,
  Trash2,
  X,
} from "lucide-react";
import { useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useDocumentActions } from "@/features/content-dashboard/hooks/use-document-actions";
import { useHoverPreview } from "@/features/content-dashboard/hooks/use-hover-preview";
import { useInlineRename } from "@/features/content-dashboard/hooks/use-inline-rename";
import { useTagEditor } from "@/features/content-dashboard/hooks/use-tag-editor";
import { smoothTransition, staggerItem } from "@/lib/motion";
import { cn } from "@/lib/utils";
import { useBoardStore } from "@/stores/board-store";
import type { BoardColumnDef } from "@/types/board";
import { CardInner, formatWordCount } from "./card-inner";
import type { ContentItem } from "./content-table-row";

type BoardCardProps = {
  item: ContentItem;
  tags: string[];
  columnId: string;
  columns?: BoardColumnDef[] | undefined;
  allProjectTags?: string[] | undefined;
  selected?: boolean | undefined;
  onSelect?: ((checked: boolean) => void) | undefined;
  onOpen: () => void;
  onDelete?: (() => void) | undefined;
  onDeleteRemote?: (() => void) | undefined;
  onDuplicated?: (() => void) | undefined;
  isOverlay?: boolean | undefined;
};

export function BoardCard({
  item,
  tags,
  columnId,
  columns,
  allProjectTags,
  selected,
  onSelect,
  onOpen,
  onDelete,
  onDeleteRemote,
  onDuplicated,
  isOverlay,
}: BoardCardProps) {
  if (item.kind === "remote" || !item.id) {
    return (
      <StaticBoardCard
        item={item}
        tags={tags}
        selected={selected}
        onSelect={onSelect}
        onOpen={onOpen}
        onDeleteRemote={onDeleteRemote}
      />
    );
  }

  if (isOverlay) {
    return (
      <div
        className={`rounded-lg border border-border/60 bg-card p-3 shadow-lg ${isOverlay ? "rotate-2 scale-105" : ""}`}
      >
        <CardInner item={item} tags={tags} />
      </div>
    );
  }

  return (
    <DraggableBoardCard
      item={item}
      tags={tags}
      columnId={columnId}
      columns={columns}
      allProjectTags={allProjectTags}
      selected={selected}
      onSelect={onSelect}
      onOpen={onOpen}
      onDelete={onDelete}
      onDeleteRemote={onDeleteRemote}
      onDuplicated={onDuplicated}
    />
  );
}

function DraggableBoardCard({
  item,
  tags,
  columnId,
  columns,
  allProjectTags,
  selected,
  onSelect,
  onOpen,
  onDelete,
  onDeleteRemote,
  onDuplicated,
}: {
  item: ContentItem;
  tags: string[];
  columnId: string;
  columns?: BoardColumnDef[] | undefined;
  allProjectTags?: string[] | undefined;
  selected?: boolean | undefined;
  onSelect?: ((checked: boolean) => void) | undefined;
  onOpen: () => void;
  onDelete?: (() => void) | undefined;
  onDeleteRemote?: (() => void) | undefined;
  onDuplicated?: (() => void) | undefined;
}) {
  const sortableId = item.id;
  if (!sortableId) {
    throw new Error("DraggableBoardCard requires item.id");
  }

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: sortableId,
    data: { item, columnId },
  });

  const activeItem = useBoardStore((s) => s.activeItem);
  const isBeingDragged = activeItem?.id === item.id;
  const isFocused = useFocusedRing(item.id);

  const rename = useInlineRename({
    documentId: item.id,
    currentTitle: item.title,
  });

  const [isEditingTags, setIsEditingTags] = useState(false);
  const tagEditor = useTagEditor({ documentId: item.id, initialTags: tags });

  const { duplicate, moveToColumn } = useDocumentActions({
    documentId: item.id,
    currentStatus: columnId,
    columns,
    onDuplicated,
  });

  const { elementRef: cardRef, previewRect } = useHoverPreview();

  const tagSuggestions = (allProjectTags ?? []).filter(
    (t) =>
      !tagEditor.tags.includes(t) &&
      t.includes(tagEditor.inputValue.toLowerCase()),
  );

  const handleStartTagEdit = () => {
    tagEditor.resetTags(tags);
    setIsEditingTags(true);
    setTimeout(() => tagEditor.inputRef.current?.focus(), 0);
  };

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging || isBeingDragged ? 0.4 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      <motion.div
        ref={cardRef}
        {...(!isDragging
          ? { variants: staggerItem, transition: smoothTransition }
          : {})}
        className={cn(
          "group relative cursor-grab rounded-lg border border-border/60 bg-card px-3.5 py-3 transition-colors hover:bg-muted/40 active:cursor-grabbing",
          isFocused && "ring-2 ring-primary/60 border-primary/40",
          selected && "border-primary/50 bg-primary/5 ring-1 ring-primary/20",
        )}
        onClick={rename.isRenaming || isEditingTags ? undefined : onOpen}
        {...listeners}
      >
        {/* Preview popover — portaled to escape column overflow clipping */}
        {previewRect &&
          item.excerpt &&
          !isDragging &&
          createPortal(
            <div
              className="pointer-events-none fixed z-50 w-72 -translate-y-full rounded-lg border bg-popover p-3 text-xs text-popover-foreground shadow-lg"
              style={{ top: previewRect.top - 8, left: previewRect.left }}
            >
              <p className="line-clamp-4 leading-relaxed text-muted-foreground">
                {item.excerpt}
              </p>
              {item.wordCount != null && (
                <p className="mt-2 text-[10px] text-muted-foreground/60">
                  {formatWordCount(item.wordCount)} words
                </p>
              )}
            </div>,
            document.body,
          )}

        {/* Action menu */}
        <div className="absolute right-2 top-2 opacity-0 transition-opacity group-hover:opacity-100">
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={(e) => e.stopPropagation()}
                />
              }
            >
              <MoreHorizontal className="size-3.5" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  onOpen();
                }}
              >
                <Pencil className="size-3.5" />
                Open in editor
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  rename.startRename();
                }}
              >
                <FileText className="size-3.5" />
                Rename
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  handleStartTagEdit();
                }}
              >
                <Tag className="size-3.5" />
                Edit tags
              </DropdownMenuItem>

              {columns && columns.length > 1 && (
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>
                    <ArrowRight className="size-3.5" />
                    Move to...
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent>
                    {columns.map((col) => (
                      <DropdownMenuItem
                        key={col.id}
                        disabled={col.id === columnId}
                        onClick={(e) => {
                          e.stopPropagation();
                          void moveToColumn(col.id);
                        }}
                      >
                        {col.id === columnId && <Check className="size-3.5" />}
                        {col.label}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
              )}

              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  void duplicate();
                }}
              >
                <Copy className="size-3.5" />
                Duplicate
              </DropdownMenuItem>

              {(onDelete || onDeleteRemote) && (
                <>
                  <DropdownMenuSeparator />
                  {onDelete && (
                    <DropdownMenuItem
                      className="text-destructive"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDelete();
                      }}
                    >
                      <Trash2 className="size-3.5" />
                      Delete
                    </DropdownMenuItem>
                  )}
                  {onDeleteRemote && (
                    <DropdownMenuItem
                      className="text-destructive"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteRemote();
                      }}
                    >
                      <Trash2 className="size-3.5" />
                      Delete from GitHub
                    </DropdownMenuItem>
                  )}
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Card content with optional checkbox */}
        <div className="flex items-start gap-2">
          {onSelect && (
            <div
              className={cn(
                "flex-none pt-1 transition-opacity",
                !selected && "opacity-0 group-hover:opacity-100",
              )}
            >
              <input
                type="checkbox"
                checked={selected ?? false}
                onChange={(e) => {
                  e.stopPropagation();
                  onSelect(e.target.checked);
                }}
                onClick={(e) => e.stopPropagation()}
                onPointerDown={(e) => e.stopPropagation()}
                className="size-3.5 cursor-pointer accent-primary"
              />
            </div>
          )}
          <div className="min-w-0 flex-1">
            {rename.isRenaming ? (
              <div
                className="flex items-center gap-1.5"
                onClick={(e) => e.stopPropagation()}
              >
                <input
                  ref={rename.inputRef}
                  type="text"
                  value={rename.renameValue}
                  onChange={(e) => rename.setRenameValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void rename.saveRename();
                    if (e.key === "Escape") rename.cancelRename();
                  }}
                  onBlur={() => void rename.saveRename()}
                  className="min-w-0 flex-1 rounded border border-input bg-transparent px-1.5 py-0.5 text-sm font-medium focus:outline-none focus:ring-1 focus:ring-ring"
                />
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={() => void rename.saveRename()}
                >
                  <Check className="size-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={rename.cancelRename}
                >
                  <X className="size-3" />
                </Button>
              </div>
            ) : (
              <CardInner
                item={item}
                tags={isEditingTags ? tagEditor.tags : tags}
                {...(columns && {
                  columns,
                  columnId,
                  onMoveToColumn: moveToColumn,
                })}
              />
            )}

            {/* Inline tag editing */}
            {isEditingTags && !rename.isRenaming && (
              <div
                className="mt-2 space-y-1.5"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex flex-wrap gap-1">
                  {tagEditor.tags.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center gap-0.5 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium"
                    >
                      {tag}
                      <button
                        type="button"
                        onClick={() => tagEditor.removeTag(tag)}
                        className="ml-0.5 rounded-full p-0.5 hover:bg-foreground/10"
                      >
                        <X className="size-2.5" />
                      </button>
                    </span>
                  ))}
                </div>
                <div className="relative">
                  <input
                    ref={tagEditor.inputRef}
                    type="text"
                    value={tagEditor.inputValue}
                    onChange={(e) => tagEditor.setInputValue(e.target.value)}
                    onKeyDown={(e) => {
                      tagEditor.handleKeyDown(e);
                      if (e.key === "Escape") setIsEditingTags(false);
                    }}
                    onBlur={() => {
                      setTimeout(() => setIsEditingTags(false), 200);
                    }}
                    placeholder="Add tag..."
                    className="w-full rounded border border-input bg-transparent px-2 py-1 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                  {tagEditor.inputValue && tagSuggestions.length > 0 && (
                    <div className="absolute top-full left-0 z-50 mt-1 w-full rounded-md border bg-popover py-1 shadow-md">
                      {tagSuggestions.slice(0, 5).map((suggestion) => (
                        <button
                          key={suggestion}
                          type="button"
                          className="w-full px-2 py-1 text-left text-xs hover:bg-muted"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            tagEditor.addTag(suggestion);
                          }}
                        >
                          {suggestion}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function StaticBoardCard({
  item,
  tags,
  selected,
  onSelect,
  onOpen,
  onDeleteRemote,
}: {
  item: ContentItem;
  tags: string[];
  selected?: boolean | undefined;
  onSelect?: ((checked: boolean) => void) | undefined;
  onOpen: () => void;
  onDeleteRemote?: (() => void) | undefined;
}) {
  return (
    <motion.div
      variants={staggerItem}
      transition={smoothTransition}
      className={cn(
        "group relative cursor-pointer rounded-lg border border-border/60 bg-card px-3.5 py-3 transition-colors hover:bg-muted/40",
        selected && "border-primary/50 bg-primary/5 ring-1 ring-primary/20",
      )}
      onClick={onOpen}
    >
      {(onDeleteRemote || onSelect) && (
        <div className="absolute right-2 top-2 opacity-0 transition-opacity group-hover:opacity-100">
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={(e) => e.stopPropagation()}
                />
              }
            >
              <MoreHorizontal className="size-3.5" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  onOpen();
                }}
              >
                <Pencil className="size-3.5" />
                Open / Import
              </DropdownMenuItem>
              {onDeleteRemote && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-destructive"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteRemote();
                    }}
                  >
                    <Trash2 className="size-3.5" />
                    Delete from GitHub
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}
      <div className="flex items-start gap-2">
        {onSelect && (
          <div
            className={cn(
              "flex-none pt-1 transition-opacity",
              !selected && "opacity-0 group-hover:opacity-100",
            )}
          >
            <input
              type="checkbox"
              checked={selected ?? false}
              onChange={(e) => {
                e.stopPropagation();
                onSelect(e.target.checked);
              }}
              onClick={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}
              className="size-3.5 cursor-pointer accent-primary"
            />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <CardInner item={item} tags={tags} />
        </div>
      </div>
    </motion.div>
  );
}

function useFocusedRing(itemId?: string) {
  const focusedCardId = useBoardStore((s) => s.focusedCardId);
  return itemId != null && focusedCardId === itemId;
}
