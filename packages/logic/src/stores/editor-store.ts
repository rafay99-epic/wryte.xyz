import { countWords } from "@wryte/logic/lib/word-count";
import { create } from "zustand";

type ViewMode = "edit" | "preview" | "split";

export type SprintStatus = "idle" | "running" | "paused" | "completed";

export type SprintEndReason = "target" | "time";

type EditorState = {
  content: string;
  title: string;
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
  switchTarget: string | null;
  pendingCaret: number | null;
  researchPanelOpen: boolean;
  readabilityPanelOpen: boolean;
  outlinePanelOpen: boolean;
  findReplaceOpen: boolean;
  imageDialogOpen: boolean;
  videoDialogOpen: boolean;
  embedDialogOpen: boolean;
  animationDialogOpen: boolean;
  sessionStartWords: number;
  sessionStartedAt: number;

  sprintStatus: SprintStatus;
  sprintTargetWords: number;
  sprintDurationMs: number;
  sprintStartWords: number;
  sprintStartedAt: number | null;
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

export const useEditorStore = create<EditorState>()((set) => ({
  ...initialState,

  setContent: (content) => set({ content, isDirty: true }),

  setTitle: (title) => set({ title, isDirty: true }),

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
      pendingCaret: null,
      ...sprintIdleState,
    })),

  markSaved: () =>
    set({
      isDirty: false,
      isSaving: false,
      lastSavedAt: Date.now(),
    }),

  setSaving: (isSaving) => set({ isSaving }),

  setViewMode: (viewMode) => set({ viewMode }),

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

  reset: () =>
    set((state) => ({ ...initialState, contentEpoch: state.contentEpoch + 1 })),
}));
