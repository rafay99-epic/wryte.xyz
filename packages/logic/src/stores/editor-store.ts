import { countWords } from "@wryte/logic/lib/word-count";
import { create } from "zustand";

/** Supported editor layout modes for the markdown editor pane. */
type ViewMode = "edit" | "preview" | "split";

/** Lifecycle of a writing sprint. `completed` keeps the HUD's celebratory
 * state on screen until the user dismisses it (back to `idle`). */
export type SprintStatus = "idle" | "running" | "paused" | "completed";

/** Why a sprint completed: the word target was hit, or time ran out. */
export type SprintEndReason = "target" | "time";

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
  /**
   * Bumped every time content is loaded into the store from outside the
   * editor surface (document load, draft switch, promote, restore). The
   * markdown editor watches this to force-sync its uncontrolled textarea —
   * a plain content comparison can't distinguish "store echoed my
   * keystroke" from "a different version whose text happens to match what
   * I last typed was loaded".
   */
  contentEpoch: number;
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
  /**
   * Tab a version switch is currently in flight for — a draft id, `"main"`,
   * or null when idle. The editor pane dims and locks input while non-null
   * so in-transit keystrokes can't land in the outgoing version's buffer.
   */
  switchTarget: string | null;
  /**
   * Caret offset the editor should jump to on its next render — set by the
   * preview's double-click-to-edit, consumed (reset to null) by the markdown
   * editor once applied. Survives the preview→edit mode switch, where the
   * textarea doesn't exist yet at the moment of the click.
   */
  pendingCaret: number | null;
  researchPanelOpen: boolean;
  readabilityPanelOpen: boolean;
  outlinePanelOpen: boolean;
  findReplaceOpen: boolean;
  imageDialogOpen: boolean;
  videoDialogOpen: boolean;
  embedDialogOpen: boolean;
  animationDialogOpen: boolean;
  /** Word count at document load — baseline for "words this session". */
  sessionStartWords: number;
  /** Timestamp of document load — denominator for session WPM. */
  sessionStartedAt: number;

  // --- Writing sprint (client-only; never written to Convex) ---
  sprintStatus: SprintStatus;
  sprintTargetWords: number;
  sprintDurationMs: number;
  /** Word count when the sprint started — baseline for the live delta. */
  sprintStartWords: number;
  /** Start of the current running segment, or null while paused/completed. */
  sprintStartedAt: number | null;
  /** Elapsed time accumulated across previous running segments (pause support). */
  sprintAccumulatedMs: number;
  sprintEndReason: SprintEndReason | null;

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
  setSwitchTarget: (target: string | null) => void;
  setPendingCaret: (offset: number | null) => void;
  toggleResearchPanel: () => void;
  toggleReadabilityPanel: () => void;
  toggleOutlinePanel: () => void;
  setFindReplaceOpen: (open: boolean) => void;
  setImageDialogOpen: (open: boolean) => void;
  setVideoDialogOpen: (open: boolean) => void;
  setEmbedDialogOpen: (open: boolean) => void;
  setAnimationDialogOpen: (open: boolean) => void;
  startSprint: (targetWords: number, durationMs: number) => void;
  pauseSprint: () => void;
  resumeSprint: () => void;
  completeSprint: (reason: SprintEndReason) => void;
  endSprint: () => void;
  reset: () => void;
};

/** Sprint fields at rest — reused by init, end, and full reset. */
const sprintIdleState = {
  sprintStatus: "idle" as SprintStatus,
  sprintTargetWords: 0,
  sprintDurationMs: 0,
  sprintStartWords: 0,
  sprintStartedAt: null as number | null,
  sprintAccumulatedMs: 0,
  sprintEndReason: null as SprintEndReason | null,
};

const initialState = {
  content: "",
  title: "",
  contentEpoch: 0,
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
  switchTarget: null as string | null,
  pendingCaret: null as number | null,
  researchPanelOpen: false,
  readabilityPanelOpen: false,
  outlinePanelOpen: false,
  findReplaceOpen: false,
  imageDialogOpen: false,
  videoDialogOpen: false,
  embedDialogOpen: false,
  animationDialogOpen: false,
  sessionStartWords: 0,
  sessionStartedAt: 0,
  ...sprintIdleState,
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
  // Also resets any sprint: its word baseline belongs to the previous document.
  initDocument: (title, content, projectId) =>
    set((state) => ({
      title,
      content,
      contentEpoch: state.contentEpoch + 1,
      activeProjectId: projectId,
      isDirty: false,
      isSaving: false,
      lastSavedAt: null,
      sessionStartWords: countWords(content),
      sessionStartedAt: Date.now(),
      // A jump queued against the previous document must not fire in this one.
      pendingCaret: null,
      ...sprintIdleState,
    })),

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

  setSwitchTarget: (target) => set({ switchTarget: target }),

  setPendingCaret: (offset) => set({ pendingCaret: offset }),

  toggleResearchPanel: () =>
    set((state) => ({ researchPanelOpen: !state.researchPanelOpen })),

  toggleReadabilityPanel: () =>
    set((state) => ({ readabilityPanelOpen: !state.readabilityPanelOpen })),

  toggleOutlinePanel: () =>
    set((state) => ({ outlinePanelOpen: !state.outlinePanelOpen })),

  setFindReplaceOpen: (open) => set({ findReplaceOpen: open }),

  setImageDialogOpen: (open) => set({ imageDialogOpen: open }),

  setVideoDialogOpen: (open) => set({ videoDialogOpen: open }),

  setEmbedDialogOpen: (open) => set({ embedDialogOpen: open }),

  setAnimationDialogOpen: (open) => set({ animationDialogOpen: open }),

  // Word baseline is captured from the CURRENT content so the live delta
  // starts at zero regardless of what was written before the sprint.
  startSprint: (targetWords, durationMs) =>
    set((state) => ({
      sprintStatus: "running",
      sprintTargetWords: targetWords,
      sprintDurationMs: durationMs,
      sprintStartWords: countWords(state.content),
      sprintStartedAt: Date.now(),
      sprintAccumulatedMs: 0,
      sprintEndReason: null,
    })),

  // Fold the current running segment into the accumulator so elapsed time
  // freezes exactly at the pause instant.
  pauseSprint: () =>
    set((state) => {
      if (state.sprintStatus !== "running" || state.sprintStartedAt === null) {
        return {};
      }
      return {
        sprintStatus: "paused",
        sprintStartedAt: null,
        sprintAccumulatedMs:
          state.sprintAccumulatedMs + (Date.now() - state.sprintStartedAt),
      };
    }),

  resumeSprint: () =>
    set((state) =>
      state.sprintStatus === "paused"
        ? { sprintStatus: "running", sprintStartedAt: Date.now() }
        : {},
    ),

  // Freeze elapsed time and keep the summary on screen until dismissed.
  completeSprint: (reason) =>
    set((state) => {
      if (state.sprintStatus !== "running") return {};
      return {
        sprintStatus: "completed",
        sprintEndReason: reason,
        sprintStartedAt: null,
        sprintAccumulatedMs:
          state.sprintAccumulatedMs +
          (state.sprintStartedAt !== null
            ? Date.now() - state.sprintStartedAt
            : 0),
      };
    }),

  endSprint: () => set({ ...sprintIdleState }),

  // Keep the epoch monotonic across resets so a remounting editor never
  // sees the same epoch for two different loads.
  reset: () =>
    set((state) => ({ ...initialState, contentEpoch: state.contentEpoch + 1 })),
}));
