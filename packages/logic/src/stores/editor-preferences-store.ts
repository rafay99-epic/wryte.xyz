import { create } from "zustand";
import { persist } from "zustand/middleware";

type EditorPreferencesState = {
  typewriterScrolling: boolean;

  toggleTypewriterScrolling: () => void;
};

export const useEditorPreferencesStore = create<EditorPreferencesState>()(
  persist(
    (set) => ({
      typewriterScrolling: true,

      toggleTypewriterScrolling: () =>
        set((state) => ({ typewriterScrolling: !state.typewriterScrolling })),
    }),
    {
      name: "wryte-editor-preferences",
      partialize: (state) => ({
        typewriterScrolling: state.typewriterScrolling,
      }),
    },
  ),
);
