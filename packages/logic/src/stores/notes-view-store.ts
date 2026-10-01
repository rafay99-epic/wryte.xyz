import type { Id } from "@wryte/backend/_generated/dataModel";
import { create } from "zustand";

type NotesViewState = {
  groupId: Id<"note_groups"> | null;
  trash: boolean;
  setGroupId: (groupId: Id<"note_groups"> | null) => void;
  setTrash: (trash: boolean) => void;
};

export const useNotesViewStore = create<NotesViewState>()((set) => ({
  groupId: null,
  trash: false,
  setGroupId: (groupId) => set({ groupId, trash: false }),
  setTrash: (trash) => set({ trash }),
}));
