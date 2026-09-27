import type { BoardColor } from "@wryte/logic/lib/board-colors";

export type BoardColumnDef = {
  id: string;
  label: string;
  color: BoardColor;
  behavior: "none" | "schedule" | "publish";
  position: number;
};

export const DEFAULT_BOARD_COLUMNS: BoardColumnDef[] = [
  {
    id: "draft",
    label: "Draft",
    color: "gray",
    behavior: "none",
    position: 0,
  },
  {
    id: "review",
    label: "Review",
    color: "amber",
    behavior: "none",
    position: 1,
  },
  {
    id: "ready",
    label: "Ready",
    color: "blue",
    behavior: "none",
    position: 2,
  },
  {
    id: "scheduled",
    label: "Scheduled",
    color: "purple",
    behavior: "schedule",
    position: 3,
  },
  {
    id: "published",
    label: "Published",
    color: "emerald",
    behavior: "publish",
    position: 4,
  },
];
