"use client";

import { motion } from "framer-motion";
import { staggerContainer } from "@/lib/motion";
import type { ParsedFrontmatter } from "@/lib/parse-frontmatter";
import type { BoardColumnDef } from "@/types/board";
import { ContentTableRow, type ContentItem } from "./content-table-row";

interface TableViewProps {
  items: ContentItem[];
  columns: BoardColumnDef[];
  frontmatterMap: Map<string, ParsedFrontmatter>;
  importingPath: string | null;
  onOpenItem: (item: ContentItem) => void;
  onDeleteLocal: (item: ContentItem) => void;
  onDeleteRemote: (item: ContentItem) => void;
}

export function TableView({
  items,
  columns,
  frontmatterMap,
  importingPath,
  onOpenItem,
  onDeleteLocal,
  onDeleteRemote,
}: TableViewProps) {
  return (
    <div className="overflow-hidden rounded-lg border">
      <table className="w-full">
        <thead>
          <tr className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
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
            return (
              <ContentTableRow
                key={item.kind === "local" ? item.id : item.path}
                item={item}
                isImporting={importingPath === item.path}
                tags={fm?.tags ?? []}
                author={fm?.author ?? null}
                columns={columns}
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
          })}
        </motion.tbody>
      </table>
    </div>
  );
}
