/**
 * TanStack Query hooks for all GitHub API routes.
 *
 * Each hook wraps a `/api/github/*` endpoint and returns the standard
 * TanStack Query result object (`data`, `isLoading`, `error`, `refetch`, etc.).
 *
 * Benefits over the previous raw-fetch approach:
 *  - Automatic caching & deduplication — multiple components can call the same
 *    hook without triggering duplicate requests.
 *  - Built-in stale/refetch — data is served from cache instantly while a
 *    background revalidation fires (stale-while-revalidate).
 *  - Cache invalidation — after mutations (upload, delete, import) you can
 *    surgically invalidate the affected query keys.
 *  - Retry & error handling baked in.
 */

import {
  type UseQueryOptions,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { githubKeys } from "@/lib/query-keys";

// ---------------------------------------------------------------------------
// Shared types
// ---------------------------------------------------------------------------

/** Repo item returned by the repos API. */
export interface RepoItem {
  fullName: string;
  name: string;
  defaultBranch: string;
  description: string | null;
  private: boolean;
  updatedAt: string;
}

/** A content (markdown) file listing entry. */
export interface ContentFile {
  name: string;
  path: string;
  sha: string;
  size: number;
}

/** A media file entry from the GitHub media API. */
export interface MediaFile {
  name: string;
  path: string;
  sha: string;
  size: number;
  downloadUrl: string;
}

/** Parsed file content returned by the content POST endpoint. */
export interface FileContent {
  frontmatter: Record<string, unknown> | null;
  content: string | null;
  sha: string | null;
  error?: string;
}

/** Detected frontmatter field from the detect-frontmatter endpoint. */
export interface DetectedField {
  name: string;
  type: string;
  required: boolean;
  defaultValue: string;
  options: string;
}

// ---------------------------------------------------------------------------
// Fetcher helpers (thin wrappers around fetch that throw on error)
// ---------------------------------------------------------------------------

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const data = await res.json();
  if (!res.ok) {
    throw new Error(
      (data as { error?: string }).error ??
        `Request failed (${String(res.status)})`,
    );
  }
  return data as T;
}

// ---------------------------------------------------------------------------
// useGithubToken — check whether GitHub OAuth is connected
// ---------------------------------------------------------------------------

interface TokenResponse {
  token: string;
}

/**
 * Fetches the user's GitHub OAuth token from Clerk.
 *
 * The token itself is rarely needed on the client — this hook is mainly used
 * to check whether the user has a valid GitHub connection (`isConnected`).
 *
 * Caches for 10 minutes since the token rarely changes mid-session.
 */
export function useGithubToken(
  options?: Partial<UseQueryOptions<TokenResponse>>,
) {
  return useQuery<TokenResponse>({
    queryKey: githubKeys.token(),
    queryFn: () => fetchJson<TokenResponse>("/api/github/token"),
    staleTime: 10 * 60 * 1000, // 10 minutes
    retry: false,
    ...options,
  });
}

// ---------------------------------------------------------------------------
// useGithubRepos — list the user's GitHub repositories
// ---------------------------------------------------------------------------

interface ReposResponse {
  repos: RepoItem[];
}

/**
 * Lists the authenticated user's GitHub repos.
 *
 * Cached for 2 minutes — repo lists don't change frequently within a session,
 * but should stay reasonably fresh when the user returns to the project wizard.
 */
export function useGithubRepos(
  options?: Partial<UseQueryOptions<ReposResponse>>,
) {
  return useQuery<ReposResponse>({
    queryKey: githubKeys.repos(),
    queryFn: () => fetchJson<ReposResponse>("/api/github/repos"),
    staleTime: 2 * 60 * 1000,
    ...options,
  });
}

// ---------------------------------------------------------------------------
// useGithubContent — list markdown files in a content directory
// ---------------------------------------------------------------------------

interface ContentListResponse {
  files: ContentFile[];
}

/**
 * Lists markdown files in a GitHub repo's content directory.
 *
 * Automatically disabled when `repo` or `path` are falsy, so it's safe to
 * call unconditionally — the query simply won't fire until the params exist.
 */
export function useGithubContentList(
  params: { repo: string | null; branch?: string; path: string | null },
  options?: Partial<UseQueryOptions<ContentListResponse>>,
) {
  const repo = params.repo ?? "";
  const branch = params.branch ?? "main";
  const path = params.path ?? "";

  return useQuery<ContentListResponse>({
    queryKey: githubKeys.contentList(repo, branch, path),
    queryFn: () => {
      const sp = new URLSearchParams({ repo, branch, path });
      return fetchJson<ContentListResponse>(
        `/api/github/content?${sp.toString()}`,
      );
    },
    enabled: Boolean(params.repo && params.path),
    staleTime: 60 * 1000, // 1 minute
    ...options,
  });
}

// ---------------------------------------------------------------------------
// useGithubFileContent — fetch a single markdown file's parsed content
// ---------------------------------------------------------------------------

/**
 * Fetches and parses a single markdown file from GitHub.
 *
 * Uses a POST under the hood (to send repo/branch/path in the body rather
 * than as query params with potential encoding issues).
 */
export function useGithubFileContent(
  params: { repo: string | null; branch?: string; path: string | null },
  options?: Partial<UseQueryOptions<FileContent>>,
) {
  const repo = params.repo ?? "";
  const branch = params.branch ?? "main";
  const path = params.path ?? "";

  return useQuery<FileContent>({
    queryKey: githubKeys.contentDetail(repo, branch, path),
    queryFn: () =>
      fetchJson<FileContent>("/api/github/content", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repo, branch, path }),
      }),
    enabled: Boolean(params.repo && params.path),
    staleTime: 30 * 1000, // 30 seconds — file content can change often
    ...options,
  });
}

// ---------------------------------------------------------------------------
// useGithubMedia — list media files in a GitHub repo
// ---------------------------------------------------------------------------

interface MediaListResponse {
  files: MediaFile[];
}

/**
 * Lists media files (images, videos, etc.) in a GitHub repo's media directory.
 *
 * This replaces the previous Zustand-based media cache. TanStack Query handles
 * caching, deduplication, and background revalidation automatically.
 */
export function useGithubMedia(
  params: { repo: string | null; branch?: string; path: string | null },
  options?: Partial<UseQueryOptions<MediaListResponse>>,
) {
  const repo = params.repo ?? "";
  const branch = params.branch ?? "main";
  const path = params.path ?? "";

  return useQuery<MediaListResponse>({
    queryKey: githubKeys.mediaList(repo, branch, path),
    queryFn: () => {
      const sp = new URLSearchParams({ repo, branch, path });
      return fetchJson<MediaListResponse>(`/api/github/media?${sp.toString()}`);
    },
    enabled: Boolean(params.repo && params.path),
    staleTime: 2 * 60 * 1000, // 2 minutes
    ...options,
  });
}

// ---------------------------------------------------------------------------
// useDetectFrontmatter — mutation to auto-detect frontmatter schema
// ---------------------------------------------------------------------------

interface DetectFrontmatterParams {
  repo: string;
  branch: string;
  contentPath: string;
}

interface DetectFrontmatterResponse {
  fields: DetectedField[] | null;
  sourceFile?: string;
  error?: string;
}

/**
 * Triggers frontmatter detection for a GitHub content directory.
 *
 * This is a mutation (not a query) because it's a one-shot user-initiated
 * action rather than data that should be cached/refetched in the background.
 */
export function useDetectFrontmatter() {
  return useMutation<DetectFrontmatterResponse, Error, DetectFrontmatterParams>(
    {
      mutationFn: (params) =>
        fetchJson<DetectFrontmatterResponse>("/api/github/detect-frontmatter", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(params),
        }),
    },
  );
}

// ---------------------------------------------------------------------------
// Invalidation helpers
// ---------------------------------------------------------------------------

/**
 * Hook that returns cache-invalidation functions.
 *
 * Usage:
 * ```ts
 * const { invalidateMedia, invalidateContent, invalidateAll } = useGithubInvalidation();
 *
 * // After uploading a file:
 * await invalidateMedia();
 *
 * // After deleting a content file:
 * await invalidateContent();
 * ```
 */
export function useGithubInvalidation() {
  const queryClient = useQueryClient();

  return {
    /** Invalidate all GitHub queries (nuclear option). */
    invalidateAll: () =>
      queryClient.invalidateQueries({ queryKey: githubKeys.all }),

    /** Invalidate the repos list. */
    invalidateRepos: () =>
      queryClient.invalidateQueries({ queryKey: githubKeys.repos() }),

    /** Invalidate all content list queries. */
    invalidateContent: () =>
      queryClient.invalidateQueries({ queryKey: githubKeys.contentLists() }),

    /** Invalidate a specific content list. */
    invalidateContentList: (repo: string, branch: string, path: string) =>
      queryClient.invalidateQueries({
        queryKey: githubKeys.contentList(repo, branch, path),
      }),

    /** Invalidate all media list queries. */
    invalidateMedia: () =>
      queryClient.invalidateQueries({ queryKey: githubKeys.mediaLists() }),

    /** Invalidate a specific media list. */
    invalidateMediaList: (repo: string, branch: string, path: string) =>
      queryClient.invalidateQueries({
        queryKey: githubKeys.mediaList(repo, branch, path),
      }),

    /** Invalidate the token check (e.g. after reconnecting GitHub). */
    invalidateToken: () =>
      queryClient.invalidateQueries({ queryKey: githubKeys.token() }),
  };
}
