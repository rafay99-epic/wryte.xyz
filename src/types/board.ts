/**
 * Board column definitions for the Notion-like kanban board.
 *
 * Each project can have a custom set of columns that documents flow through.
 * Columns are stored as a JSON-serialized string on the project record.
 */

import type { BoardColor } from "@/lib/board-colors";

export interface BoardColumnDef {
  /** Slug-like identifier: "idea", "writing", "review" */
  id: string;
  /** Display name shown in the column header */
  label: string;
  /** Color key from the 16-color palette */
  color: BoardColor;
  /** Special automation behavior when a card enters this column */
  behavior: "none" | "schedule" | "publish";
  /** Sort order (lower = further left) */
  position: number;
}

/** Default columns for new projects or projects without custom board config. */
export const DEFAULT_BOARD_COLUMNS: BoardColumnDef[] = [
  {
    id: "draft",
    label: "Draft",
    color: "gray",
    behavior: "none",
    position: 0,
  },
  {
    id: "scheduled",
    label: "Scheduled",
    color: "blue",
    behavior: "schedule",
    position: 1,
  },
  {
    id: "published",
    label: "Published",
    color: "emerald",
    behavior: "publish",
    position: 2,
  },
];
