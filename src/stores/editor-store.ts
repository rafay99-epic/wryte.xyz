import { create } from "zustand";

/** Supported editor layout modes for the markdown editor pane. */
type ViewMode = "edit" | "preview" | "split";

/**
 * Core editor state and actions managed via Zustand.
 *
 * This store is the single source of truth for the editor UI —
 * it tracks document content, save status, view layout, and sidebar visibility.
 * Components subscribe to slices of this store to avoid unnecessary re-renders.
 */
type EditorState = {
  content: string;
  title: string;
  isDirty: boolean;
  isSaving: boolean;
  lastSavedAt: number | null;
  viewMode: ViewMode;
  sidebarOpen: boolean;
  activeProjectId: string | null;
  focusMode: boolean;
  historyPanelOpen: boolean;
  _preFocusSidebarOpen: boolean | null;
  activeDraftId: string | null;
  researchPanelOpen: boolean;
  readabilityPanelOpen: boolean;
  outlinePanelOpen: boolean;
  findReplaceOpen: boolean;
  imageDialogOpen: boolean;
  videoDialogOpen: boolean;

  setContent: (content: string) => void;
  setTitle: (title: string) => void;
  initDocument: (title: string, content: string, projectId: string) => void;
  markSaved: () => void;
  setSaving: (isSaving: boolean) => void;
  setViewMode: (viewMode: ViewMode) => void;
  toggleSidebar: () => void;
  setActiveProjectId: (id: string | null) => void;
  toggleFocusMode: () => void;
  toggleHistoryPanel: () => void;
  setActiveDraftId: (id: string | null) => void;
  toggleResearchPanel: () => void;
  toggleReadabilityPanel: () => void;
  toggleOutlinePanel: () => void;
  setFindReplaceOpen: (open: boolean) => void;
  setImageDialogOpen: (open: boolean) => void;
  setVideoDialogOpen: (open: boolean) => void;
  reset: () => void;
};

const initialState = {
  content: "",
  title: "",
  isDirty: false,
  isSaving: false,
  lastSavedAt: null,
  viewMode: "edit" as const,
  sidebarOpen: true,
  activeProjectId: null as string | null,
  focusMode: false,
  historyPanelOpen: false,
  _preFocusSidebarOpen: null as boolean | null,
  activeDraftId: null as string | null,
  researchPanelOpen: false,
  readabilityPanelOpen: false,
  outlinePanelOpen: false,
  findReplaceOpen: false,
  imageDialogOpen: false,
  videoDialogOpen: false,
};

/**
 * Global editor store.
 *
 * Consumed by the editor page, autosave hook, and toolbar components.
 * Kept intentionally flat (no nesting) so Zustand's shallow equality
 * check works well with `useShallow` selectors.
 */
export const useEditorStore = create<EditorState>()((set) => ({
  ...initialState,

  // Mark dirty on every content change so autosave knows there is pending work
  setContent: (content) => set({ content, isDirty: true }),

  // Title changes are also unsaved mutations
  setTitle: (title) => set({ title, isDirty: true }),

  // Atomic init — sets title, content, and activeProjectId without marking dirty.
  // This prevents the autosave hook from firing on initial document load.
  initDocument: (title, content, projectId) =>
    set({
      title,
      content,
      activeProjectId: projectId,
      isDirty: false,
      isSaving: false,
      lastSavedAt: null,
    }),

  // Snapshot the save timestamp so the UI can display "saved X seconds ago"
  markSaved: () =>
    set({
      isDirty: false,
      isSaving: false,
      lastSavedAt: Date.now(),
    }),

  setSaving: (isSaving) => set({ isSaving }),

  setViewMode: (viewMode) => set({ viewMode }),

  // Derive new value from previous state to avoid stale-closure issues
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),

  setActiveProjectId: (id) => set({ activeProjectId: id }),

  toggleFocusMode: () =>
    set((state) => {
      if (state.focusMode) {
        return {
          focusMode: false,
          sidebarOpen: state._preFocusSidebarOpen ?? true,
          _preFocusSidebarOpen: null,
        };
      }
      return {
        focusMode: true,
        _preFocusSidebarOpen: state.sidebarOpen,
        sidebarOpen: false,
      };
    }),

  toggleHistoryPanel: () =>
    set((state) => ({ historyPanelOpen: !state.historyPanelOpen })),

  setActiveDraftId: (id) => set({ activeDraftId: id }),

  toggleResearchPanel: () =>
    set((state) => ({ researchPanelOpen: !state.researchPanelOpen })),

  toggleReadabilityPanel: () =>
    set((state) => ({ readabilityPanelOpen: !state.readabilityPanelOpen })),

  toggleOutlinePanel: () =>
    set((state) => ({ outlinePanelOpen: !state.outlinePanelOpen })),

  setFindReplaceOpen: (open) => set({ findReplaceOpen: open }),

  setImageDialogOpen: (open) => set({ imageDialogOpen: open }),

  setVideoDialogOpen: (open) => set({ videoDialogOpen: open }),

  reset: () => set(initialState),
}));
