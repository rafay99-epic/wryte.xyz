import { create } from "zustand";

/** A media file entry from the GitHub API. */
export type MediaFile = {
  name: string;
  path: string;
  sha: string;
  size: number;
  downloadUrl: string;
};

/** Cached media data for a single project. */
type ProjectMediaCache = {
  files: MediaFile[];
  /** Unix-ms timestamp of last successful fetch. */
  fetchedAt: number;
};

/**
 * Media store state and actions managed via Zustand.
 *
 * Caches media file lists per project so navigating between pages
 * does not re-fetch from GitHub every time. Data is refreshed only when:
 *  - The user explicitly clicks "Refresh"
 *  - A file is uploaded or deleted (optimistic + refetch)
 *  - The cache for that project has never been populated
 */
type MediaState = {
  /** Media file cache keyed by project ID. */
  cache: Record<string, ProjectMediaCache>;
  /** Set of project IDs currently being fetched (stored as Record for Zustand compatibility). */
  loadingMap: Record<string, boolean>;

  /** Store fetched files for a project. */
  setFiles: (projectId: string, files: MediaFile[]) => void;
  /** Mark a project as loading. */
  setLoading: (projectId: string, loading: boolean) => void;
  /** Remove a single file from cache (optimistic delete). */
  removeFile: (projectId: string, filePath: string) => void;
  /** Add a file to cache (optimistic after upload). */
  addFile: (projectId: string, file: MediaFile) => void;
  /** Clear cache for a specific project. */
  invalidate: (projectId: string) => void;
};

/** Empty array constant to avoid creating new references. */
const EMPTY_FILES: MediaFile[] = [];

export const useMediaStore = create<MediaState>()((set) => ({
  cache: {},
  loadingMap: {},

  setFiles: (projectId, files) =>
    set((state) => ({
      cache: {
        ...state.cache,
        [projectId]: { files, fetchedAt: Date.now() },
      },
    })),

  setLoading: (projectId, loading) =>
    set((state) => ({
      loadingMap: { ...state.loadingMap, [projectId]: loading },
    })),

  removeFile: (projectId, filePath) =>
    set((state) => {
      const existing = state.cache[projectId];
      if (!existing) return state;
      return {
        cache: {
          ...state.cache,
          [projectId]: {
            ...existing,
            files: existing.files.filter((f) => f.path !== filePath),
          },
        },
      };
    }),

  addFile: (projectId, file) =>
    set((state) => {
      const existing = state.cache[projectId];
      if (!existing) return state;
      const filtered = existing.files.filter((f) => f.path !== file.path);
      return {
        cache: {
          ...state.cache,
          [projectId]: {
            ...existing,
            files: [...filtered, file].sort((a, b) =>
              a.path.localeCompare(b.path),
            ),
          },
        },
      };
    }),

  invalidate: (projectId) =>
    set((state) => {
      const { [projectId]: _, ...rest } = state.cache;
      return { cache: rest };
    }),
}));

/** Select cached files for a project (returns stable empty array if uncached). */
export function selectFiles(projectId: string) {
  return (state: MediaState) => state.cache[projectId]?.files ?? EMPTY_FILES;
}

/** Select whether a project's media has been fetched at least once. */
export function selectIsCached(projectId: string) {
  return (state: MediaState) => projectId in state.cache;
}

/** Select whether a project's media is currently loading. */
export function selectIsLoading(projectId: string) {
  return (state: MediaState) => Boolean(state.loadingMap[projectId]);
}
