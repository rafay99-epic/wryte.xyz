/**
 * Zustand store for content calendar ephemeral UI state.
 *
 * Manages month navigation, drag-and-drop pending state,
 * and the unscheduled documents panel. NOT persisted —
 * resets on navigation away from the calendar page.
 */
import { create } from "zustand";

/** Lightweight document shape used by the calendar view. */
export interface CalendarDoc {
  _id: string;
  title: string;
  slug: string;
  status: string;
  scheduledAt?: number;
  publishedAt?: number;
  updatedAt: number;
  createdAt: number;
}

interface PendingDrop {
  documentId: string;
  targetDate: string; // "YYYY-MM-DD"
  existingHour?: number;
  existingMinute?: number;
}

interface CalendarState {
  // --- Month navigation ---
  viewYear: number;
  viewMonth: number; // 0-indexed

  // --- DnD ---
  activeDocument: CalendarDoc | null;
  pendingDrop: PendingDrop | null;

  // --- Unscheduled panel ---
  unscheduledPanelOpen: boolean;
  unscheduledSearch: string;
  unscheduledStatusFilter: Set<string>;

  // --- Actions ---
  goNextMonth: () => void;
  goPrevMonth: () => void;
  goToToday: () => void;
  setActiveDocument: (doc: CalendarDoc | null) => void;
  setPendingDrop: (drop: PendingDrop) => void;
  clearPendingDrop: () => void;
  toggleUnscheduledPanel: () => void;
  setUnscheduledSearch: (query: string) => void;
  toggleStatusFilter: (status: string) => void;
  reset: () => void;
}

const now = new Date();

const initialState = {
  viewYear: now.getFullYear(),
  viewMonth: now.getMonth(),
  activeDocument: null as CalendarDoc | null,
  pendingDrop: null as PendingDrop | null,
  unscheduledPanelOpen: true,
  unscheduledSearch: "",
  unscheduledStatusFilter: new Set<string>(),
};

export const useCalendarStore = create<CalendarState>()((set) => ({
  ...initialState,

  goNextMonth: () =>
    set((s) => {
      if (s.viewMonth === 11) {
        return { viewMonth: 0, viewYear: s.viewYear + 1 };
      }
      return { viewMonth: s.viewMonth + 1 };
    }),

  goPrevMonth: () =>
    set((s) => {
      if (s.viewMonth === 0) {
        return { viewMonth: 11, viewYear: s.viewYear - 1 };
      }
      return { viewMonth: s.viewMonth - 1 };
    }),

  goToToday: () => {
    const today = new Date();
    set({ viewYear: today.getFullYear(), viewMonth: today.getMonth() });
  },

  setActiveDocument: (doc) => set({ activeDocument: doc }),

  setPendingDrop: (drop) => set({ pendingDrop: drop }),
  clearPendingDrop: () => set({ pendingDrop: null }),

  toggleUnscheduledPanel: () =>
    set((s) => ({ unscheduledPanelOpen: !s.unscheduledPanelOpen })),

  setUnscheduledSearch: (query) => set({ unscheduledSearch: query }),

  toggleStatusFilter: (status) =>
    set((s) => {
      const next = new Set(s.unscheduledStatusFilter);
      if (next.has(status)) {
        next.delete(status);
      } else {
        next.add(status);
      }
      return { unscheduledStatusFilter: next };
    }),

  reset: () => set(initialState),
}));
