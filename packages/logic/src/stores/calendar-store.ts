import type { Id } from "@wryte/backend/_generated/dataModel";
import { create } from "zustand";

export type CalendarDoc = {
  _id: Id<"documents">;
  title: string;
  slug: string;
  status: string;
  scheduledAt?: number | undefined;
  publishedAt?: number | undefined;
  updatedAt: number;
  createdAt: number;
};

type PendingDrop = {
  documentId: string;
  targetDate: string;
  existingHour?: number;
  existingMinute?: number;
};

type CalendarState = {
  viewYear: number;
  viewMonth: number;

  activeDocument: CalendarDoc | null;
  pendingDrop: PendingDrop | null;

  unscheduledPanelOpen: boolean;
  unscheduledSearch: string;
  unscheduledStatusFilter: Set<string>;

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
};

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

  reset: () => {
    const today = new Date();
    set({
      ...initialState,
      viewYear: today.getFullYear(),
      viewMonth: today.getMonth(),
    });
  },
}));
