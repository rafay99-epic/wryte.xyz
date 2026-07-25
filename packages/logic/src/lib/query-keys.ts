/**
 * Centralized TanStack Query key factory.
 *
 * Keeping every query key in one place makes cache invalidation predictable:
 * you can invalidate an entire scope (e.g. all GitHub queries) or a specific
 * resource (e.g. media files for a single repo + path).
 *
 * Convention:
 *  - `all`   -> matches every query under that scope (for broad invalidation).
 *  - `lists` -> matches every "list" query under that scope.
 *  - `list(params)` -> matches one specific list query.
 *  - `detail(params)` -> matches one specific detail/fetch query.
 */
export const githubKeys = {
  /** Matches every GitHub-related query. */
  all: ["github"] as const,

  // --- Token ---
  token: () => [...githubKeys.all, "token"] as const,

  // --- Repos ---
  repos: () => [...githubKeys.all, "repos"] as const,

  // --- Branches ---
  branches: (repo: string) => [...githubKeys.all, "branches", repo] as const,

  // --- Content (markdown file listings) ---
  contentLists: () => [...githubKeys.all, "content"] as const,
  contentList: (repo: string, branch: string, path: string) =>
    [...githubKeys.contentLists(), repo, branch, path] as const,
  contentDetail: (repo: string, branch: string, filePath: string) =>
    [...githubKeys.all, "content-detail", repo, branch, filePath] as const,

  // --- Media ---
  mediaLists: () => [...githubKeys.all, "media"] as const,
  mediaList: (repo: string, branch: string, path: string) =>
    [...githubKeys.mediaLists(), repo, branch, path] as const,

  // --- Frontmatter detection ---
  detectFrontmatter: () => [...githubKeys.all, "detect-frontmatter"] as const,
};
