import {
  type UseQueryOptions,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { githubKeys } from "@wryte/logic/lib/query-keys";

export type RepoItem = {
  fullName: string;
  name: string;
  defaultBranch: string;
  description: string | null;
  private: boolean;
  updatedAt: string;
};

export type ContentFile = {
  name: string;
  path: string;
  sha: string;
  size: number;
};

type DetectedField = {
  name: string;
  type: string;
  required: boolean;
  defaultValue: string;
  options: string;
};

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) {
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

type ConnectionResponse = {
  connected: boolean;
};

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

type ReposResponse = {
  repos: RepoItem[];
};

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

type BranchesResponse = {
  branches: string[];
  defaultBranch: string;
};

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

type ContentListResponse = {
  files: ContentFile[];
};

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
    staleTime: 60 * 1000,
    ...options,
  });
}

type DetectFrontmatterParams = {
  repo: string;
  branch: string;
  contentPath: string;
};

type DetectFrontmatterResponse = {
  fields: DetectedField[] | null;
  sourceFile?: string;
  framework?: string;
  frontmatterFormat?: "yaml" | "toml";
  basis?: string;
  sampledCount?: number;
  sources?: string[];
  error?: string;
};

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

export function useGithubInvalidation() {
  const queryClient = useQueryClient();

  return {
    invalidateContent: () =>
      queryClient.invalidateQueries({ queryKey: githubKeys.contentLists() }),
  };
}
