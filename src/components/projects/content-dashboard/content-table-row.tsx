"use client";

import { useMutation } from "convex/react";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Check,
  Cloud,
  Copy,
  FileText,
  Loader2,
  MoreHorizontal,
  Pencil,
  Trash2,
} from "lucide-react";
import { useCallback } from "react";
import { toast } from "sonner";
import { DocumentStatusBadge } from "@/components/documents/document-status-badge";
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
import type { BoardColumnDef } from "@/types/board";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { TagBadges } from "./tag-badges";

/** Unified content row type shared between table and board views. */
export interface ContentItem {
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
}

interface ContentTableRowProps {
  item: ContentItem;
  isImporting: boolean;
  tags: string[];
  author: string | null;
  columns?: BoardColumnDef[] | undefined;
  onOpen: () => void;
  onDelete?: (() => void) | undefined;
  onDeleteRemote?: (() => void) | undefined;
}

export function ContentTableRow({
  item,
  isImporting,
  tags,
  author,
  columns,
  onOpen,
  onDelete,
  onDeleteRemote,
}: ContentTableRowProps) {
  const duplicateDoc = useMutation(api.documents.duplicate);
  const moveCard = useMutation(api.documents.moveCard);

  const handleDuplicate = useCallback(async () => {
    if (!item.id) return;
    try {
      const result = await duplicateDoc({
        documentId: item.id as Id<"documents">,
      });
      toast.success(`Duplicated as "${result.title}"`);
    } catch {
      toast.error("Failed to duplicate document");
    }
  }, [item.id, duplicateDoc]);

  const handleMoveToColumn = useCallback(
    async (targetColumnId: string) => {
      if (!item.id || targetColumnId === item.status) return;
      try {
        await moveCard({
          documentId: item.id as Id<"documents">,
          targetStatus: targetColumnId,
          boardPosition: Date.now(),
        });
        const targetLabel =
          columns?.find((c) => c.id === targetColumnId)?.label ??
          targetColumnId;
        toast.success(`Moved to "${targetLabel}"`);
      } catch {
        toast.error("Failed to move document");
      }
    },
    [item.id, item.status, moveCard, columns],
  );

  const isLocal = item.kind === "local";
  const hasActions = onDelete || onDeleteRemote || isLocal;

  return (
    <motion.tr
      variants={staggerItem}
      transition={smoothTransition}
      className="group cursor-pointer border-b last:border-b-0 transition-colors hover:bg-muted/30"
      onClick={onOpen}
    >
      {/* Title + meta */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          {item.kind === "remote" ? (
            <Cloud className="size-3.5 shrink-0 text-blue-500" />
          ) : item.needsSync ? (
            <span className="relative flex size-3.5 shrink-0">
              <FileText className="size-3.5 text-foreground" />
              <Cloud className="absolute -right-1 -bottom-0.5 size-2 text-amber-500" />
            </span>
          ) : item.synced ? (
            <span className="relative flex size-3.5 shrink-0">
              <FileText className="size-3.5 text-foreground" />
              <Cloud className="absolute -right-1 -bottom-0.5 size-2 text-blue-500" />
            </span>
          ) : (
            <FileText className="size-3.5 shrink-0 text-muted-foreground" />
          )}
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
                          void handleMoveToColumn(col.id);
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
                    void handleDuplicate();
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
