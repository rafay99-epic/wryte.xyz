/**
 * Zustand store for project content search & filter state.
 *
 * Persists per-project search preferences (sort order, active tag filters,
 * kind filter) to localStorage so the user's view is restored on revisit.
 * The search query itself is NOT persisted (always starts fresh).
 */
import { create } from "zustand";
import { persist } from "zustand/middleware";

export type SortOrder = "newest" | "oldest" | "a-z" | "z-a" | "relevance";
export type KindFilter = "all" | "local" | "remote";

type SearchPerProject = {
  sortOrder: SortOrder;
  kindFilter: KindFilter;
  tagFilters: string[];
  statusFilter: string | null;
};

type SearchState = {
  /** Current search query (transient — never persisted). */
  query: string;

  /** Per-project persisted preferences. Keyed by projectId. */
  projects: Record<string, SearchPerProject>;

  // --- Actions ---
  setQuery: (q: string) => void;

  getSortOrder: (projectId: string) => SortOrder;
  setSortOrder: (projectId: string, order: SortOrder) => void;

  getKindFilter: (projectId: string) => KindFilter;
  setKindFilter: (projectId: string, filter: KindFilter) => void;

  getTagFilters: (projectId: string) => string[];
  toggleTagFilter: (projectId: string, tag: string) => void;
  clearTagFilters: (projectId: string) => void;

  getStatusFilter: (projectId: string) => string | null;
  setStatusFilter: (projectId: string, status: string | null) => void;

  /** Clear all filters for a project (keeps sort order). */
  clearFilters: (projectId: string) => void;

  /** Count of active filters for a project (excluding search query). */
  getActiveFilterCount: (projectId: string) => number;
};

const DEFAULT_PROJECT: SearchPerProject = {
  sortOrder: "newest",
  kindFilter: "all",
  tagFilters: [],
  statusFilter: null,
};

function getProject(state: SearchState, projectId: string): SearchPerProject {
  return state.projects[projectId] ?? DEFAULT_PROJECT;
}

function updateProject(
  state: SearchState,
  projectId: string,
  patch: Partial<SearchPerProject>,
): Partial<SearchState> {
  const current = getProject(state, projectId);
  return {
    projects: {
      ...state.projects,
      [projectId]: { ...current, ...patch },
    },
  };
}

export const useSearchStore = create<SearchState>()(
  persist(
    (set, get) => ({
      query: "",
      projects: {},

      setQuery: (q) => set({ query: q }),

      getSortOrder: (projectId) => getProject(get(), projectId).sortOrder,
      setSortOrder: (projectId, order) =>
        set((s) => updateProject(s, projectId, { sortOrder: order })),

      getKindFilter: (projectId) => getProject(get(), projectId).kindFilter,
      setKindFilter: (projectId, filter) =>
        set((s) => updateProject(s, projectId, { kindFilter: filter })),

      getTagFilters: (projectId) => getProject(get(), projectId).tagFilters,
      toggleTagFilter: (projectId, tag) =>
        set((s) => {
          const current = getProject(s, projectId);
          const tags = current.tagFilters.includes(tag)
            ? current.tagFilters.filter((t) => t !== tag)
            : [...current.tagFilters, tag];
          return updateProject(s, projectId, { tagFilters: tags });
        }),
      clearTagFilters: (projectId) =>
        set((s) => updateProject(s, projectId, { tagFilters: [] })),

      getStatusFilter: (projectId) => getProject(get(), projectId).statusFilter,
      setStatusFilter: (projectId, status) =>
        set((s) => updateProject(s, projectId, { statusFilter: status })),

      clearFilters: (projectId) =>
        set((s) =>
          updateProject(s, projectId, {
            kindFilter: "all",
            tagFilters: [],
            statusFilter: null,
          }),
        ),

      getActiveFilterCount: (projectId) => {
        const p = getProject(get(), projectId);
        let count = 0;
        if (p.kindFilter !== "all") count++;
        if (p.statusFilter) count++;
        count += p.tagFilters.length;
        return count;
      },
    }),
    {
      name: "wryte:search",
      partialize: (state) => ({
        // Only persist per-project prefs, not the transient query
        projects: state.projects,
      }),
    },
  ),
);
