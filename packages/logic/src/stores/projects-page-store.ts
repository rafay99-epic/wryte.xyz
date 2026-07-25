import { create } from "zustand";

/**
 * Client state for the /projects page: optimistic favorite toggles so the UI
 * moves immediately while Convex catches up, without extra subscriptions per card.
 */
type ProjectsPageState = {
  /** When set, overrides `project.isFavorite` from Convex until cleared. */
  favoriteOverrides: Record<string, boolean>;
  setFavoriteOptimistic: (projectId: string, isFavorite: boolean) => void;
  clearFavoriteOverride: (projectId: string) => void;
  reset: () => void;
};

export const useProjectsPageStore = create<ProjectsPageState>((set) => ({
  favoriteOverrides: {},
  setFavoriteOptimistic: (projectId, isFavorite) =>
    set((s) => ({
      favoriteOverrides: { ...s.favoriteOverrides, [projectId]: isFavorite },
    })),
  clearFavoriteOverride: (projectId) =>
    set((s) => {
      if (!(projectId in s.favoriteOverrides)) return s;
      const next = { ...s.favoriteOverrides };
      delete next[projectId];
      return { favoriteOverrides: next };
    }),
  reset: () => set({ favoriteOverrides: {} }),
}));
