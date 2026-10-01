import { api } from "@wryte/backend/_generated/api";
import type { Id } from "@wryte/backend/_generated/dataModel";
import type {
  BoardCard,
  BoardColumn,
} from "@wryte/backend/cms/notes/_lib/model";
import { useAuthedQuery } from "@wryte/logic/hooks/use-authed-query";
import { EDITOR_SESSION_ID } from "@wryte/logic/lib/editor/session";
import {
  BOARD_PAGE_SIZE,
  type BoardExtras,
  insertCard,
  isBoardColumn,
  mergeColumns,
  pageCursor,
  placeCard,
  placementAt,
  withoutCard,
} from "@wryte/logic/lib/notes/board";
import type { KanbanCommitMeta } from "@wryte/ui/kanban";
import { useConvex, useMutation } from "convex/react";
import { useCallback, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

type ColumnFlags = Partial<Record<BoardColumn, boolean>>;

export function useNotesBoard(groupId: Id<"note_groups"> | null) {
  const convex = useConvex();
  const args = useMemo(() => (groupId ? { groupId } : {}), [groupId]);
  const board = useAuthedQuery(api.cms.notes.board.board, args);
  const [extras, setExtras] = useState<BoardExtras>({});
  const [extraMore, setExtraMore] = useState<ColumnFlags>({});
  const [loading, setLoading] = useState<ColumnFlags>({});
  const placingRef = useRef(new Map<Id<"notes">, BoardCard>());

  const moveMutation = useMutation(api.cms.notes.board.move);
  const move = useMemo(
    () =>
      moveMutation.withOptimisticUpdate((store, { noteId, to, beforeId }) => {
        const card = placingRef.current.get(noteId);
        const current = store.getQuery(api.cms.notes.board.board, args);
        if (!card || !current) return;
        store.setQuery(api.cms.notes.board.board, args, {
          ...current,
          columns: insertCard(current.columns, card, to, beforeId ?? null),
        });
      }),
    [moveMutation, args],
  );

  const columns = useMemo(
    () => (board ? mergeColumns(board, extras) : undefined),
    [board, extras],
  );

  const hasMore = useCallback(
    (column: BoardColumn) =>
      (board?.more[column] ?? false) && (extraMore[column] ?? true),
    [board, extraMore],
  );

  const loadMore = useCallback(
    (column: BoardColumn) => {
      if (!columns || loading[column]) return;
      setLoading((prev) => ({ ...prev, [column]: true }));
      convex
        .query(api.cms.notes.board.column, {
          ...args,
          status: column,
          after: pageCursor(columns[column]),
          limit: BOARD_PAGE_SIZE,
        })
        .then(
          (page) => {
            setExtras((prev) => ({
              ...prev,
              [column]: [...(prev[column] ?? []), ...page.cards],
            }));
            setExtraMore((prev) => ({ ...prev, [column]: page.more }));
          },
          (error: unknown) => {
            console.error("[Notes] Load more failed:", error);
            toast.error("Couldn't load more cards");
          },
        )
        .finally(() => {
          setLoading((prev) => ({ ...prev, [column]: false }));
        });
    },
    [args, columns, convex, loading],
  );

  const commit = useCallback(
    (value: Record<string, BoardCard[]>, meta: KanbanCommitMeta<BoardCard>) => {
      const to = meta.overContainer;
      if (meta.kind !== "item" || !isBoardColumn(to)) return;
      const cards = value[to] ?? [];
      const index = meta.overIndex;
      const current = cards[index];
      if (!current) return;

      const placed = placeCard(
        current,
        to,
        cards[index - 1],
        cards[index + 1],
        Date.now(),
      );
      const previousExtras = extras;
      setExtras({
        ...withoutCard(extras, placed._id),
        [to]: cards.map((card, at) => (at === index ? placed : card)),
      });
      placingRef.current.set(placed._id, placed);

      move({
        noteId: placed._id,
        to,
        ...placementAt(cards, index),
        writer: EDITOR_SESSION_ID,
      })
        .catch((error: unknown) => {
          console.error("[Notes] Move failed:", error);
          setExtras(previousExtras);
          toast.error("Couldn't move the card");
        })
        .finally(() => {
          if (placingRef.current.get(placed._id) === placed) {
            placingRef.current.delete(placed._id);
          }
        });
    },
    [extras, move],
  );

  return { columns, hasMore, loadMore, loading, commit };
}
