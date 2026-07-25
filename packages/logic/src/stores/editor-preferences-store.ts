import { create } from "zustand";
import { persist } from "zustand/middleware";

/**
 * Persisted, device-local editor preferences.
 *
 * Separate from `useEditorStore` on purpose: that store is ephemeral session
 * state (reset when the editor unmounts), while these survive across
 * documents and reloads via localStorage. Client-only — never synced to the
 * backend.
 */
type EditorPreferencesState = {
  /**
   * Typewriter scrolling (focus-mode sub-preference, default ON): while
   * focus mode is active, keep the caret line vertically centered in the
   * editor scroll pane.
   */
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
      // Only persist the data, not the actions
      partialize: (state) => ({
        typewriterScrolling: state.typewriterScrolling,
      }),
    },
  ),
);
