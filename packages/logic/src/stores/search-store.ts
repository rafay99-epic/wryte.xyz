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
  query: string;

  projects: Record<string, SearchPerProject>;

  setQuery: (q: string) => void;

  getSortOrder: (projectId: string) => SortOrder;
  setSortOrder: (projectId: string, order: SortOrder) => void;

  getKindFilter: (projectId: string) => KindFilter;

  getTagFilters: (projectId: string) => string[];
  toggleTagFilter: (projectId: string, tag: string) => void;
  clearTagFilters: (projectId: string) => void;

  getStatusFilter: (projectId: string) => string | null;
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
    }),
    {
      name: "wryte:search",
      partialize: (state) => ({
        projects: state.projects,
      }),
    },
  ),
);
