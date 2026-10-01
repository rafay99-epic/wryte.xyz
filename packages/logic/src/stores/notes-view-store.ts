import type { NotesView } from "@wryte/logic/lib/notes/views";
import { create } from "zustand";

type NotesViewState = {
  view: NotesView;
  navOpen: boolean;
  setView: (view: NotesView) => void;
  setNavOpen: (open: boolean) => void;
};

export const useNotesViewStore = create<NotesViewState>()((set) => ({
  view: { kind: "all" },
  navOpen: false,
  setView: (view) => set({ view, navOpen: false }),
  setNavOpen: (navOpen) => set({ navOpen }),
}));
