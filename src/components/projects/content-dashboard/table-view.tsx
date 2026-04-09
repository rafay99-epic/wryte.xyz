"use client";

import { motion } from "framer-motion";
import { staggerContainer } from "@/lib/motion";
import type { ParsedFrontmatter } from "@/lib/parse-frontmatter";
import type { BoardColumnDef } from "@/types/board";
import { type ContentItem, ContentTableRow } from "./content-table-row";

interface TableViewProps {
  items: ContentItem[];
  columns: BoardColumnDef[];
  frontmatterMap: Map<string, ParsedFrontmatter>;
  importingPath: string | null;
  /** Whether to show the selection checkbox column. */
  showSelection: boolean;
  selectedPaths: Set<string>;
  onToggleSelect: (path: string, checked: boolean) => void;
  onToggleSelectAll: (checked: boolean) => void;
  onOpenItem: (item: ContentItem) => void;
  onDeleteLocal: (item: ContentItem) => void;
  onDeleteRemote: (item: ContentItem) => void;
}

export function TableView({
  items,
  columns,
  frontmatterMap,
  importingPath,
  showSelection,
  selectedPaths,
  onToggleSelect,
  onToggleSelectAll,
  onOpenItem,
  onDeleteLocal,
  onDeleteRemote,
}: TableViewProps) {
  const remoteItems = items.filter((i) => i.kind === "remote");
  const hasRemoteItems = remoteItems.length > 0;
  const allRemoteSelected =
    hasRemoteItems && remoteItems.every((i) => selectedPaths.has(i.path));

  return (
    <div className="overflow-hidden rounded-lg border">
      <table className="w-full">
        <thead>
          <tr className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
            {showSelection && (
              <th className="w-10 pl-4 py-2.5">
                {hasRemoteItems && (
                  <input
                    type="checkbox"
                    checked={allRemoteSelected}
                    onChange={(e) => onToggleSelectAll(e.target.checked)}
                    className="size-4 rounded border-muted-foreground/30 accent-primary cursor-pointer"
                    title="Select all remote files"
                  />
                )}
              </th>
            )}
            <th className="px-4 py-2.5 font-medium">Title</th>
            <th className="hidden px-4 py-2.5 font-medium lg:table-cell">
              Tags
            </th>
            <th className="hidden px-4 py-2.5 font-medium sm:table-cell">
              Status
            </th>
            <th className="hidden px-4 py-2.5 font-medium xl:table-cell">
              Author
            </th>
            <th className="hidden px-4 py-2.5 font-medium md:table-cell">
              Updated
            </th>
            <th className="w-10 px-4 py-2.5" />
          </tr>
        </thead>
        <motion.tbody
          variants={staggerContainer}
          initial="initial"
          animate="animate"
        >
          {items.map((item) => {
            const fm = item.id ? frontmatterMap.get(item.id) : undefined;
            const isRemote = item.kind === "remote";
            return (
              <ContentTableRow
                key={isRemote ? item.path : (item.id ?? item.path)}
                item={item}
                isImporting={importingPath === item.path}
                tags={fm?.tags ?? []}
                author={fm?.author ?? null}
                columns={columns}
                showSelectionCell={showSelection}
                selected={isRemote ? selectedPaths.has(item.path) : undefined}
                onSelect={
                  isRemote
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
                  isRemote && item.sha ? () => onDeleteRemote(item) : undefined
                }
              />
            );
          })}
        </motion.tbody>
      </table>
    </div>
  );
}
