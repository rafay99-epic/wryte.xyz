"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useMutation } from "convex/react";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Check,
  Cloud,
  Copy,
  FileText,
  GripVertical,
  MoreHorizontal,
  Pencil,
  Tag,
  Trash2,
  X,
} from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";
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
import { smoothTransition, staggerItem } from "@/lib/motion";
import { cn } from "@/lib/utils";
import { useBoardStore } from "@/stores/board-store";
import type { BoardColumnDef } from "@/types/board";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import type { ContentItem } from "./content-table-row";
import { TagBadges } from "./tag-badges";

interface BoardCardProps {
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
  /** When true, renders as a drag overlay clone (no sortable, no actions). */
  isOverlay?: boolean | undefined;
}

/** Board card that can be dragged between columns. Remote items are not draggable. */
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
    return <CardContent item={item} tags={tags} isOverlay />;
  }

  return (
    <DraggableBoardCard
      item={item}
      tags={tags}
      columnId={columnId}
      columns={columns}
      allProjectTags={allProjectTags}
      onOpen={onOpen}
      onDelete={onDelete}
      onDeleteRemote={onDeleteRemote}
      onDuplicated={onDuplicated}
    />
  );
}

/** Draggable version for local items with an ID. */
function DraggableBoardCard({
  item,
  tags,
  columnId,
  columns,
  allProjectTags,
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

  // Inline rename state
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(item.title);
  const renameInputRef = useRef<HTMLInputElement>(null);

  // Inline tag editing state
  const [isEditingTags, setIsEditingTags] = useState(false);
  const [tagInput, setTagInput] = useState("");
  const [editTags, setEditTags] = useState<string[]>(tags);
  const tagInputRef = useRef<HTMLInputElement>(null);

  const updateDocument = useMutation(api.cms.documents.update);
  const moveCard = useMutation(api.cms.documents.moveCard);
  const duplicateDoc = useMutation(api.cms.documents.duplicate);
  const updateTagsMutation = useMutation(api.cms.documents.updateTags);

  const handleStartRename = useCallback(() => {
    setRenameValue(item.title);
    setIsRenaming(true);
    setTimeout(() => renameInputRef.current?.select(), 0);
  }, [item.title]);

  const handleSaveRename = useCallback(async () => {
    const trimmed = renameValue.trim();
    if (!trimmed || trimmed === item.title) {
      setIsRenaming(false);
      return;
    }
    try {
      await updateDocument({
        documentId: item.id as Id<"documents">,
        title: trimmed,
      });
      setIsRenaming(false);
    } catch {
      toast.error("Failed to rename document");
    }
  }, [renameValue, item.title, item.id, updateDocument]);

  const handleCancelRename = useCallback(() => {
    setIsRenaming(false);
    setRenameValue(item.title);
  }, [item.title]);

  const handleMoveToColumn = useCallback(
    async (targetColumnId: string) => {
      if (!item.id || targetColumnId === columnId) return;
      try {
        await moveCard({
          documentId: item.id as Id<"documents">,
          targetStatus: targetColumnId,
          boardPosition: Date.now(), // place at end
        });
        const targetLabel =
          columns?.find((c) => c.id === targetColumnId)?.label ??
          targetColumnId;
        toast.success(`Moved to "${targetLabel}"`);
      } catch {
        toast.error("Failed to move card");
      }
    },
    [item.id, columnId, moveCard, columns],
  );

  const handleDuplicate = useCallback(async () => {
    if (!item.id) return;
    try {
      const result = await duplicateDoc({
        documentId: item.id as Id<"documents">,
      });
      toast.success(`Duplicated as "${result.title}"`);
      onDuplicated?.();
    } catch {
      toast.error("Failed to duplicate document");
    }
  }, [item.id, duplicateDoc, onDuplicated]);

  // Tag editing handlers
  const handleStartTagEdit = useCallback(() => {
    setEditTags(tags);
    setTagInput("");
    setIsEditingTags(true);
    setTimeout(() => tagInputRef.current?.focus(), 0);
  }, [tags]);

  const handleAddTag = useCallback(
    (tag: string) => {
      const trimmed = tag.trim().toLowerCase();
      if (!trimmed || editTags.includes(trimmed)) return;
      const newTags = [...editTags, trimmed];
      setEditTags(newTags);
      setTagInput("");
      if (item.id) {
        void updateTagsMutation({
          documentId: item.id as Id<"documents">,
          tags: newTags,
        });
      }
    },
    [editTags, item.id, updateTagsMutation],
  );

  const handleRemoveTag = useCallback(
    (tag: string) => {
      const newTags = editTags.filter((t) => t !== tag);
      setEditTags(newTags);
      if (item.id) {
        void updateTagsMutation({
          documentId: item.id as Id<"documents">,
          tags: newTags,
        });
      }
    },
    [editTags, item.id, updateTagsMutation],
  );

  const handleTagKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" || e.key === ",") {
        e.preventDefault();
        handleAddTag(tagInput);
      } else if (
        e.key === "Backspace" &&
        tagInput === "" &&
        editTags.length > 0
      ) {
        const lastTag = editTags[editTags.length - 1];
        if (lastTag !== undefined) {
          handleRemoveTag(lastTag);
        }
      } else if (e.key === "Escape") {
        setIsEditingTags(false);
      }
    },
    [tagInput, editTags, handleAddTag, handleRemoveTag],
  );

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging || isBeingDragged ? 0.4 : 1,
  };

  // Filtered suggestions for tag autocomplete
  const tagSuggestions = (allProjectTags ?? []).filter(
    (t) => !editTags.includes(t) && t.includes(tagInput.toLowerCase()),
  );

  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      <motion.div
        {...(!isDragging
          ? { variants: staggerItem, transition: smoothTransition }
          : {})}
        className="group relative cursor-pointer rounded-lg border border-border/60 bg-card p-3 transition-colors hover:bg-muted/40"
        onClick={isRenaming || isEditingTags ? undefined : onOpen}
      >
        {/* Drag handle */}
        <div
          className="absolute left-0.5 top-1/2 -translate-y-1/2 opacity-0 transition-opacity group-hover:opacity-60 cursor-grab active:cursor-grabbing"
          {...listeners}
          onClick={(e) => e.stopPropagation()}
        >
          <GripVertical className="size-3.5 text-muted-foreground" />
        </div>

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
                  handleStartRename();
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

              {/* Move to column submenu */}
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
                          void handleMoveToColumn(col.id);
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
                  void handleDuplicate();
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

        {/* Card content — inline rename mode or normal */}
        {isRenaming ? (
          <div
            className="flex items-center gap-1.5"
            onClick={(e) => e.stopPropagation()}
          >
            <input
              ref={renameInputRef}
              type="text"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void handleSaveRename();
                if (e.key === "Escape") handleCancelRename();
              }}
              onBlur={() => void handleSaveRename()}
              className="min-w-0 flex-1 rounded border border-input bg-transparent px-1.5 py-0.5 text-sm font-medium focus:outline-none focus:ring-1 focus:ring-ring"
            />
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={() => void handleSaveRename()}
            >
              <Check className="size-3" />
            </Button>
            <Button variant="ghost" size="icon-xs" onClick={handleCancelRename}>
              <X className="size-3" />
            </Button>
          </div>
        ) : (
          <CardInner item={item} tags={isEditingTags ? editTags : tags} />
        )}

        {/* Inline tag editing */}
        {isEditingTags && !isRenaming && (
          <div
            className="mt-2 space-y-1.5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-wrap gap-1">
              {editTags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-0.5 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium"
                >
                  {tag}
                  <button
                    type="button"
                    onClick={() => handleRemoveTag(tag)}
                    className="ml-0.5 rounded-full p-0.5 hover:bg-foreground/10"
                  >
                    <X className="size-2.5" />
                  </button>
                </span>
              ))}
            </div>
            <div className="relative">
              <input
                ref={tagInputRef}
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={handleTagKeyDown}
                onBlur={() => {
                  // Delay to allow suggestion click
                  setTimeout(() => setIsEditingTags(false), 200);
                }}
                placeholder="Add tag..."
                className="w-full rounded border border-input bg-transparent px-2 py-1 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              />
              {tagInput && tagSuggestions.length > 0 && (
                <div className="absolute top-full left-0 z-50 mt-1 w-full rounded-md border bg-popover py-1 shadow-md">
                  {tagSuggestions.slice(0, 5).map((suggestion) => (
                    <button
                      key={suggestion}
                      type="button"
                      className="w-full px-2 py-1 text-left text-xs hover:bg-muted"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        handleAddTag(suggestion);
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
      </motion.div>
    </div>
  );
}

/** Non-draggable card for remote items. */
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
        "group relative cursor-pointer rounded-lg border border-border/60 bg-card p-3 transition-colors hover:bg-muted/40",
        selected && "border-primary/50 bg-primary/5 ring-1 ring-primary/20",
      )}
      onClick={onOpen}
    >
      {/* Selection checkbox */}
      {onSelect && (
        <div className="absolute left-2 top-2 z-10">
          <input
            type="checkbox"
            checked={selected ?? false}
            onChange={(e) => {
              e.stopPropagation();
              onSelect(e.target.checked);
            }}
            onClick={(e) => e.stopPropagation()}
            className={cn(
              "size-4 rounded border-muted-foreground/30 accent-primary cursor-pointer",
              !selected &&
                "opacity-0 group-hover:opacity-100 transition-opacity",
            )}
          />
        </div>
      )}

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
      <CardInner item={item} tags={tags} />
    </motion.div>
  );
}

/** Shared inner card content: icon, title, slug, tags. */
function CardInner({ item, tags }: { item: ContentItem; tags: string[] }) {
  return (
    <>
      <div className="flex items-start gap-2">
        {item.kind === "remote" ? (
          <Cloud className="mt-0.5 size-3.5 shrink-0 text-blue-500" />
        ) : item.needsSync ? (
          <span className="relative mt-0.5 flex size-3.5 shrink-0">
            <FileText className="size-3.5 text-foreground" />
            <Cloud className="absolute -right-1 -bottom-0.5 size-2 text-amber-500" />
          </span>
        ) : item.synced ? (
          <span className="relative mt-0.5 flex size-3.5 shrink-0">
            <FileText className="size-3.5 text-foreground" />
            <Cloud className="absolute -right-1 -bottom-0.5 size-2 text-blue-500" />
          </span>
        ) : (
          <FileText className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
        )}
        <div className="min-w-0 flex-1 pr-6">
          <p className="text-sm font-medium leading-snug">{item.title}</p>
          <p className="mt-0.5 truncate font-mono text-[11px] text-muted-foreground/60">
            {item.kind === "remote" ? item.path : `/${item.slug}`}
          </p>
        </div>
      </div>
      {tags.length > 0 && (
        <div className="mt-2">
          <TagBadges tags={tags} max={2} />
        </div>
      )}
    </>
  );
}

/** Overlay version — shown while dragging. */
function CardContent({
  item,
  tags,
  isOverlay,
}: {
  item: ContentItem;
  tags: string[];
  isOverlay?: boolean;
}) {
  return (
    <div
      className={`rounded-lg border border-border/60 bg-card p-3 shadow-lg ${isOverlay ? "rotate-2 scale-105" : ""}`}
    >
      <CardInner item={item} tags={tags} />
    </div>
  );
}
