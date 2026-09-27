/**
 * TanStack Query hooks for all GitHub API routes.
 *
 * Each hook wraps a `/api/github/*` endpoint and returns the standard
 * TanStack Query result object (`data`, `isLoading`, `error`, `refetch`, etc.).
 * Keys come from `githubKeys` so callers can invalidate by scope.
 */

import {
  type UseQueryOptions,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { githubKeys } from "@wryte/logic/lib/query-keys";

// ---------------------------------------------------------------------------
// Shared types
// ---------------------------------------------------------------------------

/** Repo item returned by the repos API. */
export type RepoItem = {
  fullName: string;
  name: string;
  defaultBranch: string;
  description: string | null;
  private: boolean;
  updatedAt: string;
};

/** A content (markdown) file listing entry. */
export type ContentFile = {
  name: string;
  path: string;
  sha: string;
  size: number;
};

/** Detected frontmatter field from the detect-frontmatter endpoint. */
type DetectedField = {
  name: string;
  type: string;
  required: boolean;
  defaultValue: string;
  options: string;
};

// ---------------------------------------------------------------------------
// Fetcher helpers (thin wrappers around fetch that throw on error)
// ---------------------------------------------------------------------------

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) {
    // Error bodies may be JSON `{ error }` or plain text/HTML (proxy errors).
    const body: unknown = await res.json().catch(() => null);
    const message =
      body && typeof body === "object" && "error" in body
        ? body.error
        : undefined;
    throw new Error(
      typeof message === "string"
        ? message
        : `Request failed (${String(res.status)})`,
    );
  }
  return (await res.json()) as T;
}

// ---------------------------------------------------------------------------
// useGithubToken — check whether GitHub OAuth is connected
// ---------------------------------------------------------------------------

type ConnectionResponse = {
  connected: boolean;
};

/**
 * Reports whether the user has linked GitHub via Clerk OAuth.
 *
 * The OAuth token never crosses the network boundary — all GitHub calls
 * are proxied through `/api/github/*` routes or Convex actions that fetch
 * the token server-side. The hook returns `connected: true/false` only.
 */
export function useGithubToken(
  options?: Partial<UseQueryOptions<ConnectionResponse>>,
) {
  return useQuery<ConnectionResponse>({
    queryKey: githubKeys.token(),
    queryFn: () => fetchJson<ConnectionResponse>("/api/github/token"),
    staleTime: 10 * 60 * 1000,
    retry: false,
    ...options,
  });
}

// ---------------------------------------------------------------------------
// useGithubRepos — list the user's GitHub repositories
// ---------------------------------------------------------------------------

type ReposResponse = {
  repos: RepoItem[];
};

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
// useGithubBranches — list branches for a repo + return the default
// ---------------------------------------------------------------------------

type BranchesResponse = {
  branches: string[];
  defaultBranch: string;
};

/**
 * Lists the branches for a given repo. Used by the project settings UI to
 * populate a branch dropdown — users pick from a list instead of typing
 * the branch name, and the repo's actual default is auto-selected on
 * first connect.
 *
 * Pass `repo` as `null`/`undefined` to skip the request — useful when the
 * user hasn't picked a repo yet.
 */
export function useGithubBranches(
  repo: string | null | undefined,
  options?: Partial<UseQueryOptions<BranchesResponse>>,
) {
  return useQuery<BranchesResponse>({
    queryKey: githubKeys.branches(repo ?? ""),
    queryFn: () =>
      fetchJson<BranchesResponse>(
        `/api/github/branches?repo=${encodeURIComponent(repo ?? "")}`,
      ),
    enabled: Boolean(repo),
    staleTime: 2 * 60 * 1000,
    ...options,
  });
}

// ---------------------------------------------------------------------------
// useGithubContent — list markdown files in a content directory
// ---------------------------------------------------------------------------

type ContentListResponse = {
  files: ContentFile[];
};

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
// useDetectFrontmatter — mutation to auto-detect frontmatter schema
// ---------------------------------------------------------------------------

type DetectFrontmatterParams = {
  repo: string;
  branch: string;
  contentPath: string;
};

type DetectFrontmatterResponse = {
  fields: DetectedField[] | null;
  sourceFile?: string;
  /** Detected static-site framework (astro/hugo/nextjs/jekyll/…). */
  framework?: string;
  /** Observed frontmatter delimiter style — "yaml" (---) or "toml" (+++). */
  frontmatterFormat?: "yaml" | "toml";
  /** Where the field types came from: framework-config | samples | mixed | none. */
  basis?: string;
  /** How many real posts were sampled to build the schema. */
  sampledCount?: number;
  /** Config + sampled files that informed the result. */
  sources?: string[];
  error?: string;
};

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
 * const { invalidateContent } = useGithubInvalidation();
 *
 * // After deleting a content file:
 * await invalidateContent();
 * ```
 */
export function useGithubInvalidation() {
  const queryClient = useQueryClient();

  return {
    /** Invalidate all content list queries. */
    invalidateContent: () =>
      queryClient.invalidateQueries({ queryKey: githubKeys.contentLists() }),
  };
}
