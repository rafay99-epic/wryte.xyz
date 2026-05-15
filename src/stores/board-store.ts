/**
 * Zustand store for board-specific transient UI state.
 *
 * Manages drag-and-drop state, optimistic card positions, tag filters,
 * column editing state, and scheduling dialog triggers. Follows the same
 * flat-store, no-persist pattern as `editor-store.ts`.
 *
 * NOT persisted — all state is ephemeral and resets on navigation.
 * Call `reset()` when navigating away from the project page.
 */
import { create } from "zustand";
import type { ContentItem } from "@/features/content-dashboard/components/content-table-row";

type BoardState = {
  // --- Drag-and-drop ---
  /** The item currently being dragged, or null when idle. */
  activeItem: ContentItem | null;
  /** Column ID the dragged card is currently hovering over. */
  overColumnId: string | null;

  // --- Optimistic card positions ---
  /**
   * Temporary card-to-column mapping applied immediately on drop, before
   * the Convex mutation confirms. Cleared when Convex reactive query updates.
   */
  optimisticMoves: Map<string, { status: string; boardPosition: number }>;

  // --- Tag filters ---
  /** Active tag filters. Empty = show all. OR logic. */
  activeTagFilters: Set<string>;

  // --- Column editing ---
  /** Column ID currently being renamed inline, or null. */
  editingColumnId: string | null;
  /** Whether the board settings dialog is open. */
  settingsDialogOpen: boolean;

  // --- Scheduling dialog (triggered by schedule-on-drop) ---
  /** Document ID needing scheduling after drop, or null. */
  pendingScheduleDocId: string | null;
  /** The column the card came from before the schedule drop. */
  pendingSchedulePrevStatus: string | null;

  // --- Actions ---
  setActiveItem: (item: ContentItem | null) => void;
  setOverColumnId: (id: string | null) => void;

  applyOptimisticMove: (
    itemId: string,
    status: string,
    boardPosition: number,
  ) => void;
  clearOptimisticMove: (itemId: string) => void;
  clearAllOptimisticMoves: () => void;

  toggleTagFilter: (tag: string) => void;
  setTagFilters: (tags: Set<string>) => void;
  clearTagFilters: () => void;

  setEditingColumnId: (id: string | null) => void;
  setSettingsDialogOpen: (open: boolean) => void;

  setPendingSchedule: (docId: string, prevStatus: string) => void;
  clearPendingSchedule: () => void;

  /** Reset all board state back to defaults. */
  reset: () => void;
};

const initialState = {
  activeItem: null as ContentItem | null,
  overColumnId: null as string | null,
  optimisticMoves: new Map<string, { status: string; boardPosition: number }>(),
  activeTagFilters: new Set<string>(),
  editingColumnId: null as string | null,
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

  clearAllOptimisticMoves: () => set({ optimisticMoves: new Map() }),

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

  setTagFilters: (tags) => set({ activeTagFilters: tags }),
  clearTagFilters: () => set({ activeTagFilters: new Set() }),

  setEditingColumnId: (id) => set({ editingColumnId: id }),
  setSettingsDialogOpen: (open) => set({ settingsDialogOpen: open }),

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

  reset: () =>
    set({
      activeItem: null,
      overColumnId: null,
      optimisticMoves: new Map(),
      activeTagFilters: new Set(),
      editingColumnId: null,
      settingsDialogOpen: false,
      pendingScheduleDocId: null,
      pendingSchedulePrevStatus: null,
    }),
}));
