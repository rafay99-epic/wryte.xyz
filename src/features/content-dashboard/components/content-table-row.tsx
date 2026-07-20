"use client";

import { motion } from "framer-motion";
import {
  ArrowRight,
  Check,
  Cloud,
  Copy,
  Loader2,
  MoreHorizontal,
  Pencil,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { DocumentStatusBadge } from "@/components/ui/document-status-badge";
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
import { smoothTransition, staggerItem } from "@/lib/motion";
import { cn } from "@/lib/utils";
import type { BoardColumnDef } from "@/types/board";
import { TagBadges } from "./tag-badges";

/** Unified content row type shared between table and board views. */
export type ContentItem = {
  kind: "local" | "remote";
  id?: string;
  title: string;
  slug: string;
  path: string;
  status?: string;
  synced: boolean;
  needsSync?: boolean | undefined;
  excerpt: string;
  updatedAt?: number;
  size?: number;
  sha?: string;
  tags?: string[];
  boardPosition?: number;
  wordCount?: number;
};

type ContentTableRowProps = {
  item: ContentItem;
  isImporting: boolean;
  tags: string[];
  author: string | null;
  columns?: BoardColumnDef[] | undefined;
  /** Whether to render the selection cell (keeps columns aligned). */
  showSelectionCell?: boolean | undefined;
  selected?: boolean | undefined;
  onSelect?: ((checked: boolean) => void) | undefined;
  onOpen: () => void;
  onDelete?: (() => void) | undefined;
  onDeleteRemote?: (() => void) | undefined;
  /** 30d pageviews for this item, when analytics is connected. */
  views?: number | undefined;
  /** Whether to render the Views column at all (keeps columns aligned). */
  showViewsCell?: boolean | undefined;
};

export function ContentTableRow({
  item,
  isImporting,
  tags,
  author,
  columns,
  showSelectionCell,
  selected,
  onSelect,
  onOpen,
  onDelete,
  onDeleteRemote,
  views,
  showViewsCell,
}: ContentTableRowProps) {
  const { duplicate, moveToColumn } = useDocumentActions({
    documentId: item.id,
    currentStatus: item.status,
    columns,
  });

  const isLocal = item.kind === "local";
  const hasActions = onDelete || onDeleteRemote || isLocal;

  return (
    <motion.tr
      variants={staggerItem}
      transition={smoothTransition}
      data-testid={`content-item-${item.slug}`}
      className={cn(
        "group cursor-pointer border-b last:border-b-0 transition-colors hover:bg-muted/30",
        selected && "bg-primary/5",
      )}
      onClick={onOpen}
    >
      {/* Selection checkbox cell — always rendered when column is visible to keep alignment */}
      {showSelectionCell && (
        <td className="w-10 pl-4 py-3">
          {onSelect && (
            <input
              type="checkbox"
              checked={selected ?? false}
              onChange={(e) => {
                e.stopPropagation();
                onSelect(e.target.checked);
              }}
              onClick={(e) => e.stopPropagation()}
              className="size-4 rounded border-muted-foreground/30 accent-primary cursor-pointer"
            />
          )}
        </td>
      )}

      {/* Title + meta */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="truncate text-sm font-medium">{item.title}</span>
              {isImporting && (
                <Loader2 className="size-3 shrink-0 animate-spin text-muted-foreground" />
              )}
            </div>
            <p className="truncate font-mono text-xs text-muted-foreground">
              {item.kind === "remote" ? item.path : `/${item.slug}`}
              {item.size !== undefined && (
                <span className="ml-2 text-muted-foreground/50">
                  {(item.size / 1024).toFixed(1)} KB
                </span>
              )}
            </p>
          </div>
        </div>
      </td>

      {/* Tags */}
      <td className="hidden px-4 py-3 lg:table-cell">
        <TagBadges tags={tags} max={3} />
      </td>

      {/* Status */}
      <td className="hidden px-4 py-3 sm:table-cell">
        {item.kind === "local" && item.status ? (
          <DocumentStatusBadge status={item.status} columns={columns} />
        ) : (
          <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-950 dark:text-blue-300">
            <Cloud className="size-2.5" />
            Remote
          </span>
        )}
      </td>

      {/* Author */}
      <td className="hidden px-4 py-3 text-xs text-muted-foreground xl:table-cell">
        {author ?? "—"}
      </td>

      {/* Updated */}
      <td className="hidden px-4 py-3 text-xs text-muted-foreground md:table-cell">
        {item.updatedAt
          ? new Date(item.updatedAt).toLocaleDateString()
          : item.kind === "remote"
            ? "On GitHub"
            : "—"}
      </td>

      {/* Views (30d) */}
      {showViewsCell && (
        <td className="hidden px-4 py-3 text-right text-xs text-muted-foreground tabular-nums lg:table-cell">
          {views !== undefined ? views.toLocaleString() : "—"}
        </td>
      )}

      {/* Actions */}
      <td className="px-4 py-3">
        {hasActions && (
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-xs"
                  className="opacity-0 group-hover:opacity-100"
                  onClick={(e) => e.stopPropagation()}
                />
              }
            >
              <MoreHorizontal className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  onOpen();
                }}
              >
                <Pencil className="size-3.5" />
                {item.kind === "remote" ? "Open / Import" : "Open in editor"}
              </DropdownMenuItem>

              {/* Move to column — only for local items */}
              {isLocal && columns && columns.length > 1 && (
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>
                    <ArrowRight className="size-3.5" />
                    Move to...
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent>
                    {columns.map((col) => (
                      <DropdownMenuItem
                        key={col.id}
                        disabled={col.id === item.status}
                        onClick={(e) => {
                          e.stopPropagation();
                          void moveToColumn(col.id);
                        }}
                      >
                        {col.id === item.status && (
                          <Check className="size-3.5" />
                        )}
                        {col.label}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
              )}

              {/* Duplicate — only for local items */}
              {isLocal && item.id && (
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    void duplicate();
                  }}
                >
                  <Copy className="size-3.5" />
                  Duplicate
                </DropdownMenuItem>
              )}

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
                      <Trash2 className="size-4" />
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
                      <Trash2 className="size-4" />
                      Delete from GitHub
                    </DropdownMenuItem>
                  )}
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </td>
    </motion.tr>
  );
}
