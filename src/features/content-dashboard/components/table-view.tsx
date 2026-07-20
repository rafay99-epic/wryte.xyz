"use client";

import { motion } from "framer-motion";
import { staggerContainer } from "@/lib/motion";
import type { ParsedFrontmatter } from "@/lib/parse-frontmatter";
import type { BoardColumnDef } from "@/types/board";
import { type ContentItem, ContentTableRow } from "./content-table-row";

type TableViewProps = {
  items: ContentItem[];
  columns: BoardColumnDef[];
  frontmatterMap: Map<string, ParsedFrontmatter>;
  importingPath: string | null;
  /** Whether to show the selection checkbox column. */
  showSelection: boolean;
  selectedPaths: Set<string>;
  selectedDocIds?: Set<string> | undefined;
  onToggleSelect: (path: string, checked: boolean) => void;
  onToggleSelectAll: (checked: boolean) => void;
  onToggleDocSelect?: ((docId: string, checked: boolean) => void) | undefined;
  onToggleSelectAllLocal?: ((checked: boolean) => void) | undefined;
  onOpenItem: (item: ContentItem) => void;
  onDeleteLocal: (item: ContentItem) => void;
  onDeleteRemote: (item: ContentItem) => void;
  /** 30d pageviews per item id/path, from the analytics snapshot. Column is hidden when undefined. */
  views?: Map<string, number> | undefined;
};

export function TableView({
  items,
  columns,
  frontmatterMap,
  importingPath,
  showSelection,
  selectedPaths,
  selectedDocIds,
  onToggleSelect,
  onToggleSelectAll,
  onToggleDocSelect,
  onToggleSelectAllLocal,
  onOpenItem,
  onDeleteLocal,
  onDeleteRemote,
  views,
}: TableViewProps) {
  const remoteItems = items.filter((i) => i.kind === "remote");
  const localItems = items.filter((i) => i.kind === "local" && i.id);
  const hasRemoteItems = remoteItems.length > 0;
  const hasLocalItems = localItems.length > 0;
  const allRemoteSelected =
    hasRemoteItems && remoteItems.every((i) => selectedPaths.has(i.path));
  const allLocalSelected =
    hasLocalItems &&
    selectedDocIds !== undefined &&
    localItems.every((i) => i.id && selectedDocIds.has(i.id));
  const showCheckbox = showSelection || onToggleDocSelect !== undefined;

  return (
    <div className="overflow-hidden rounded-lg border">
      <table className="w-full">
        <thead>
          <tr className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
            {showCheckbox && (
              <th className="w-10 pl-4 py-2.5">
                {hasRemoteItems && showSelection && (
                  <input
                    type="checkbox"
                    checked={allRemoteSelected}
                    onChange={(e) => onToggleSelectAll(e.target.checked)}
                    className="size-4 rounded border-muted-foreground/30 accent-primary cursor-pointer"
                    title="Select all remote files"
                  />
                )}
                {!hasRemoteItems && hasLocalItems && onToggleSelectAllLocal && (
                  <input
                    type="checkbox"
                    checked={allLocalSelected === true}
                    onChange={(e) => onToggleSelectAllLocal(e.target.checked)}
                    className="size-4 rounded border-muted-foreground/30 accent-primary cursor-pointer"
                    title="Select all articles"
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
            {views && (
              <th className="hidden px-4 py-2.5 text-right font-medium lg:table-cell">
                Views
              </th>
            )}
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
                showSelectionCell={showCheckbox}
                selected={
                  isRemote
                    ? selectedPaths.has(item.path)
                    : item.id && selectedDocIds?.has(item.id)
                      ? true
                      : onToggleDocSelect
                        ? false
                        : undefined
                }
                onSelect={
                  isRemote
                    ? (checked) => onToggleSelect(item.path, checked)
                    : item.id && onToggleDocSelect
                      ? (checked) => onToggleDocSelect(item.id ?? "", checked)
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
                showViewsCell={views !== undefined}
                views={item.id ? views?.get(item.id) : undefined}
              />
            );
          })}
        </motion.tbody>
      </table>
    </div>
  );
}
