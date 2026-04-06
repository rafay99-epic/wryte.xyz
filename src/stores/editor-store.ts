import { create } from "zustand";

type ViewMode = "edit" | "preview" | "split";

interface EditorState {
  content: string;
  title: string;
  isDirty: boolean;
  isSaving: boolean;
  lastSavedAt: number | null;
  viewMode: ViewMode;
  sidebarOpen: boolean;

  setContent: (content: string) => void;
  setTitle: (title: string) => void;
  markSaved: () => void;
  setSaving: (isSaving: boolean) => void;
  setViewMode: (viewMode: ViewMode) => void;
  toggleSidebar: () => void;
  reset: () => void;
}

const initialState = {
  content: "",
  title: "",
  isDirty: false,
  isSaving: false,
  lastSavedAt: null,
  viewMode: "edit" as const,
  sidebarOpen: true,
};

export const useEditorStore = create<EditorState>()((set) => ({
  ...initialState,

  setContent: (content) => set({ content, isDirty: true }),

  setTitle: (title) => set({ title, isDirty: true }),

  markSaved: () =>
    set({
      isDirty: false,
      isSaving: false,
      lastSavedAt: Date.now(),
    }),

  setSaving: (isSaving) => set({ isSaving }),

  setViewMode: (viewMode) => set({ viewMode }),

  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),

  reset: () => set(initialState),
}));
