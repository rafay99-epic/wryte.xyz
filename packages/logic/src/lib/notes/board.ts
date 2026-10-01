import type { Id } from "@wryte/backend/_generated/dataModel";
import {
  type BoardCard,
  type BoardColumn,
  boardPositionBetween,
  type NoteStatus,
} from "@wryte/backend/cms/notes/_lib/model";
import { NOTE_STATUS_LABELS } from "@wryte/logic/lib/notes/status";

export const BOARD_COLUMNS = [
  "notes",
  "todo",
  "doing",
  "done",
] as const satisfies readonly BoardColumn[];

export const BOARD_COLUMN_LABELS: Record<BoardColumn, string> = {
  notes: "Notes",
  ...NOTE_STATUS_LABELS,
};

export const BOARD_PAGE_SIZE = 50;

export type BoardColumns = Record<BoardColumn, BoardCard[]>;

export type BoardSnapshot = {
  columns: BoardColumns;
  more: Record<BoardColumn, boolean>;
};

export type BoardExtras = Partial<Record<BoardColumn, readonly BoardCard[]>>;

export type BoardPlacement = {
  beforeId: Id<"notes"> | null;
  afterId: Id<"notes"> | null;
};

export function isBoardColumn(value: string): value is BoardColumn {
  return BOARD_COLUMNS.some((column) => column === value);
}

export function columnOf(card: { status?: NoteStatus | undefined }) {
  return card.status ?? "notes";
}

function positionOf(card: BoardCard | undefined): number {
  return card?.boardPosition ?? Number.NEGATIVE_INFINITY;
}

export function pageCursor(cards: readonly BoardCard[]): number {
  return cards.at(-1)?.boardPosition ?? -Number.MAX_VALUE;
}

export function mergeColumns(
  board: BoardSnapshot,
  extras: BoardExtras,
): BoardColumns {
  const loaded = new Set<string>();
  for (const column of BOARD_COLUMNS) {
    for (const card of board.columns[column]) loaded.add(card._id);
  }
  const merge = (column: BoardColumn): BoardCard[] => {
    const base = board.columns[column];
    const extra = extras[column];
    if (!board.more[column] || !extra?.length) return base;
    const last = positionOf(base.at(-1));
    const tail = extra.filter(
      (card) => !loaded.has(card._id) && positionOf(card) > last,
    );
    return tail.length ? [...base, ...tail] : base;
  };
  return {
    notes: merge("notes"),
    todo: merge("todo"),
    doing: merge("doing"),
    done: merge("done"),
  };
}

export function placementAt(
  cards: readonly BoardCard[],
  index: number,
): BoardPlacement {
  return {
    beforeId: cards[index - 1]?._id ?? null,
    afterId: cards[index + 1]?._id ?? null,
  };
}

export function placeCard(
  card: BoardCard,
  to: BoardColumn,
  above: BoardCard | undefined,
  below: BoardCard | undefined,
  now: number,
): BoardCard {
  const abovePosition = above?.boardPosition ?? null;
  const belowPosition = below?.boardPosition ?? null;
  const boardPosition =
    boardPositionBetween(abovePosition, belowPosition) ??
    ((abovePosition ?? 0) + (belowPosition ?? 0)) / 2;
  const { status, completedAt, dueDate, ...rest } = card;
  if (to === "notes") return { ...rest, boardPosition };
  const finishedAt =
    to !== "done" ? undefined : status === "done" ? completedAt : now;
  return {
    ...rest,
    boardPosition,
    status: to,
    ...(dueDate !== undefined ? { dueDate } : {}),
    ...(finishedAt !== undefined ? { completedAt: finishedAt } : {}),
  };
}

export function insertCard(
  columns: BoardColumns,
  card: BoardCard,
  to: BoardColumn,
  beforeId: Id<"notes"> | null,
): BoardColumns {
  const without = (column: BoardColumn) =>
    columns[column].filter((item) => item._id !== card._id);
  const next: BoardColumns = {
    notes: without("notes"),
    todo: without("todo"),
    doing: without("doing"),
    done: without("done"),
  };
  const target = next[to];
  const index =
    beforeId === null
      ? 0
      : target.findIndex((item) => item._id === beforeId) + 1;
  if (index > 0 || beforeId === null) target.splice(index, 0, card);
  return next;
}

export function withoutCard(
  extras: BoardExtras,
  noteId: Id<"notes">,
): BoardExtras {
  const next: BoardExtras = {};
  for (const column of BOARD_COLUMNS) {
    const cards = extras[column];
    if (cards) next[column] = cards.filter((card) => card._id !== noteId);
  }
  return next;
}
