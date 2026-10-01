import type { Announcements, UniqueIdentifier } from "@dnd-kit/core";
import type { BoardCard } from "@wryte/backend/cms/notes/_lib/model";
import {
  BOARD_COLUMN_LABELS,
  isBoardColumn,
} from "@wryte/logic/lib/notes/board";
import { useEffect, useMemo, useRef } from "react";

type Columns = Record<string, BoardCard[]>;

function describe(columns: Columns, id: UniqueIdentifier) {
  for (const [column, cards] of Object.entries(columns)) {
    const index = cards.findIndex((card) => card._id === id);
    const card = cards[index];
    if (card && isBoardColumn(column)) {
      return {
        title: card.title || "Untitled",
        place: `${BOARD_COLUMN_LABELS[column]}, position ${String(index + 1)} of ${String(cards.length)}`,
      };
    }
  }
  return { title: "Card", place: "" };
}

export function useBoardAnnouncements(
  columns: Columns | undefined,
): Announcements {
  const columnsRef = useRef<Columns>({});
  useEffect(() => {
    if (columns) columnsRef.current = columns;
  }, [columns]);

  return useMemo<Announcements>(() => {
    const at = (id: UniqueIdentifier) => describe(columnsRef.current, id);
    return {
      onDragStart: ({ active }) => {
        const { title, place } = at(active.id);
        return `Picked up ${title}, in ${place}.`;
      },
      onDragOver: ({ active, over }) => {
        if (!over) return undefined;
        const { title, place } = at(active.id);
        return `${title} moved to ${place}.`;
      },
      onDragEnd: ({ active }) => {
        const { title, place } = at(active.id);
        return `${title} dropped in ${place}.`;
      },
      onDragCancel: ({ active }) => {
        const { title } = at(active.id);
        return `Moving ${title} was cancelled.`;
      },
    };
  }, []);
}
