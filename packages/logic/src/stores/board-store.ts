import type { ContentItem } from "@wryte/logic/types/content";
import { create } from "zustand";

type BoardState = {
  activeItem: ContentItem | null;
  overColumnId: string | null;

  optimisticMoves: Map<string, { status: string; boardPosition: number }>;

  activeTagFilters: Set<string>;

  settingsDialogOpen: boolean;

  collapsedColumns: Set<string>;

  focusedCardId: string | null;

  pendingScheduleDocId: string | null;
  pendingSchedulePrevStatus: string | null;

  setActiveItem: (item: ContentItem | null) => void;
  setOverColumnId: (id: string | null) => void;

  applyOptimisticMove: (
    itemId: string,
    status: string,
    boardPosition: number,
  ) => void;
  clearOptimisticMove: (itemId: string) => void;

  toggleTagFilter: (tag: string) => void;
  clearTagFilters: () => void;

  setSettingsDialogOpen: (open: boolean) => void;

  toggleColumnCollapsed: (columnId: string) => void;
  setFocusedCardId: (id: string | null) => void;

  setPendingSchedule: (docId: string, prevStatus: string) => void;
  clearPendingSchedule: () => void;

  reset: () => void;
};

const initialState = {
  activeItem: null as ContentItem | null,
  overColumnId: null as string | null,
  optimisticMoves: new Map<string, { status: string; boardPosition: number }>(),
  activeTagFilters: new Set<string>(),
  collapsedColumns: new Set<string>(),
  focusedCardId: null as string | null,
  settingsDialogOpen: false,
  pendingScheduleDocId: null as string | null,
  pendingSchedulePrevStatus: null as string | null,
};

export const useBoardStore = create<BoardState>()((set) => ({
  ...initialState,

  setActiveItem: (item) => set({ activeItem: item }),
  setOverColumnId: (id) => set({ overColumnId: id }),

  applyOptimisticMove: (itemId, status, boardPosition) =>
    set((state) => {
      const next = new Map(state.optimisticMoves);
      next.set(itemId, { status, boardPosition });
      return { optimisticMoves: next };
    }),

  clearOptimisticMove: (itemId) =>
    set((state) => {
      const next = new Map(state.optimisticMoves);
      next.delete(itemId);
      return { optimisticMoves: next };
    }),

  toggleTagFilter: (tag) =>
    set((state) => {
      const next = new Set(state.activeTagFilters);
      if (next.has(tag)) {
        next.delete(tag);
      } else {
        next.add(tag);
      }
      return { activeTagFilters: next };
    }),

  clearTagFilters: () => set({ activeTagFilters: new Set() }),

  setSettingsDialogOpen: (open) => set({ settingsDialogOpen: open }),

  toggleColumnCollapsed: (columnId) =>
    set((state) => {
      const next = new Set(state.collapsedColumns);
      if (next.has(columnId)) {
        next.delete(columnId);
      } else {
        next.add(columnId);
      }
      return { collapsedColumns: next };
    }),

  setFocusedCardId: (id) => set({ focusedCardId: id }),

  setPendingSchedule: (docId, prevStatus) =>
    set({
      pendingScheduleDocId: docId,
      pendingSchedulePrevStatus: prevStatus,
    }),

  clearPendingSchedule: () =>
    set({
      pendingScheduleDocId: null,
      pendingSchedulePrevStatus: null,
    }),

  reset: () => set(initialState),
}));
