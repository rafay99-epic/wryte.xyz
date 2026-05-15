import type { Hotkey } from "@tanstack/hotkeys";
import { useHotkeys } from "@tanstack/react-hotkeys";
import { useMutation } from "convex/react";
import { useCallback, useMemo } from "react";
import { toast } from "sonner";
import type { ContentItem } from "@/features/content-dashboard/components/content-table-row";
import { isInputFocused } from "@/lib/dom-utils";
import { useBoardStore } from "@/stores/board-store";
import type { BoardColumnDef } from "@/types/board";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";

/**
 * Registers vim-style keyboard shortcuts for board navigation and
 * card movement. Shortcuts: j/k (up/down), h/l (left/right columns),
 * Enter (open), Escape (clear focus), m+1-9 (move to column N).
 */
export function useBoardKeyboardNav({
  columns,
  grouped,
  items,
  onOpenItem,
}: {
  columns: BoardColumnDef[];
  grouped: Record<string, ContentItem[]>;
  items: ContentItem[];
  onOpenItem: (item: ContentItem) => void;
}) {
  const focusedCardId = useBoardStore((s) => s.focusedCardId);
  const setFocusedCardId = useBoardStore((s) => s.setFocusedCardId);
  const moveCard = useMutation(api.cms.documents.moveCard);

  const flatCards = useMemo(() => {
    const cards: { id: string; columnId: string; colIdx: number }[] = [];
    for (let ci = 0; ci < columns.length; ci++) {
      const col = columns[ci];
      if (!col) continue;
      for (const item of grouped[col.id] ?? []) {
        if (item.id) cards.push({ id: item.id, columnId: col.id, colIdx: ci });
      }
    }
    return cards;
  }, [columns, grouped]);

  const moveFocus = useCallback(
    (direction: "up" | "down" | "left" | "right") => {
      if (flatCards.length === 0) return;
      const currentIdx = flatCards.findIndex((c) => c.id === focusedCardId);

      if (currentIdx === -1) {
        setFocusedCardId(flatCards[0]?.id ?? null);
        return;
      }

      const current = flatCards[currentIdx];
      if (!current) return;

      if (direction === "up" || direction === "down") {
        const delta = direction === "up" ? -1 : 1;
        const next = currentIdx + delta;
        if (next >= 0 && next < flatCards.length) {
          setFocusedCardId(flatCards[next]?.id ?? null);
        }
      } else {
        const targetColIdx = current.colIdx + (direction === "left" ? -1 : 1);
        if (targetColIdx < 0 || targetColIdx >= columns.length) return;
        const targetCol = columns[targetColIdx];
        if (!targetCol) return;
        const colCards = flatCards.filter((c) => c.colIdx === targetColIdx);
        if (colCards.length > 0) {
          setFocusedCardId(colCards[0]?.id ?? null);
        }
      }
    },
    [flatCards, focusedCardId, columns, setFocusedCardId],
  );

  const handleKeyboardMove = useCallback(
    (targetColIdx: number) => {
      if (!focusedCardId) return;
      const col = columns[targetColIdx];
      if (!col) return;
      const current = flatCards.find((c) => c.id === focusedCardId);
      if (!current || current.columnId === col.id) return;
      void moveCard({
        documentId: focusedCardId as Id<"documents">,
        targetStatus: col.id,
        boardPosition: Date.now(),
      }).then(() => {
        toast.success(`Moved to "${col.label}"`);
      });
    },
    [focusedCardId, columns, flatCards, moveCard],
  );

  const boardHotkeys = useMemo(
    () => [
      {
        hotkey: "j" as Hotkey,
        callback: (e: KeyboardEvent) => {
          if (isInputFocused()) return;
          e.preventDefault();
          moveFocus("down");
        },
      },
      {
        hotkey: "k" as Hotkey,
        callback: (e: KeyboardEvent) => {
          if (isInputFocused()) return;
          e.preventDefault();
          moveFocus("up");
        },
      },
      {
        hotkey: "h" as Hotkey,
        callback: (e: KeyboardEvent) => {
          if (isInputFocused()) return;
          e.preventDefault();
          moveFocus("left");
        },
      },
      {
        hotkey: "l" as Hotkey,
        callback: (e: KeyboardEvent) => {
          if (isInputFocused()) return;
          e.preventDefault();
          moveFocus("right");
        },
      },
      {
        hotkey: "Enter" as Hotkey,
        callback: (e: KeyboardEvent) => {
          if (isInputFocused()) return;
          if (!focusedCardId) return;
          e.preventDefault();
          const item = items.find((i) => i.id === focusedCardId);
          if (item) onOpenItem(item);
        },
      },
      {
        hotkey: "Escape" as Hotkey,
        callback: () => {
          if (isInputFocused()) return;
          setFocusedCardId(null);
        },
      },
      ...columns.slice(0, 9).map((_col, idx) => ({
        hotkey: `m+${String(idx + 1)}` as Hotkey,
        callback: (e: KeyboardEvent) => {
          if (isInputFocused()) return;
          e.preventDefault();
          handleKeyboardMove(idx);
        },
      })),
    ],
    [
      moveFocus,
      focusedCardId,
      items,
      columns,
      onOpenItem,
      setFocusedCardId,
      handleKeyboardMove,
    ],
  );

  useHotkeys(boardHotkeys, { preventDefault: false });
}
