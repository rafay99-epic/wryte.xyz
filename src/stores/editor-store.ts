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
interface EditorState {
  /** Raw markdown content currently in the editor textarea. */
  content: string;
  /** Document title shown in the header / tab. */
  title: string;
  /** Whether the in-memory content has diverged from the last persisted version. */
  isDirty: boolean;
  /** True while an autosave network request is in-flight. */
  isSaving: boolean;
  /** Unix-ms timestamp of the most recent successful save, or null if never saved this session. */
  lastSavedAt: number | null;
  /** Current editor layout: edit-only, preview-only, or side-by-side split. */
  viewMode: ViewMode;
  /** Whether the document/navigation sidebar is expanded. */
  sidebarOpen: boolean;
  /** Currently selected project ID for sidebar navigation — null when on dashboard/global pages. */
  activeProjectId: string | null;

  /** Update markdown content and mark the document as dirty (unsaved changes). */
  setContent: (content: string) => void;
  /** Update the document title and mark the document as dirty. */
  setTitle: (title: string) => void;
  /**
   * Initialise the editor with a loaded document's data in a single atomic update.
   * Unlike calling setTitle + setContent separately, this does NOT mark the store
   * as dirty — preventing the autosave hook from triggering a spurious save.
   */
  initDocument: (title: string, content: string, projectId: string) => void;
  /** Called after a successful save — clears dirty/saving flags and records the timestamp. */
  markSaved: () => void;
  /** Toggle the saving indicator (used by the autosave hook). */
  setSaving: (isSaving: boolean) => void;
  /** Switch editor layout between edit, preview, and split modes. */
  setViewMode: (viewMode: ViewMode) => void;
  /** Toggle sidebar open/closed. */
  toggleSidebar: () => void;
  /** Set the active project for sidebar navigation. */
  setActiveProjectId: (id: string | null) => void;
  /** Reset all editor state back to defaults (e.g. when navigating away from a document). */
  reset: () => void;
}

/** Default state used on first mount and when resetting the store. */
const initialState = {
  content: "",
  title: "",
  isDirty: false,
  isSaving: false,
  lastSavedAt: null,
  viewMode: "edit" as const,
  sidebarOpen: true,
  activeProjectId: null as string | null,
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

  // Wipe everything — prevents stale data when switching documents
  reset: () => set(initialState),
}));
