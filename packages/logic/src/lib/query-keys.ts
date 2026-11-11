export const configKeys = {
  all: ["config"] as const,

  files: (projectId: string, root: string) =>
    [...configKeys.all, "files", projectId, root] as const,

  file: (projectId: string, path: string) =>
    [...configKeys.all, "file", projectId, path] as const,
};

export const githubKeys = {
  all: ["github"] as const,

  token: () => [...githubKeys.all, "token"] as const,

  repos: () => [...githubKeys.all, "repos"] as const,

  branches: (repo: string) => [...githubKeys.all, "branches", repo] as const,

  contentLists: () => [...githubKeys.all, "content"] as const,
  contentList: (repo: string, branch: string, path: string) =>
    [...githubKeys.contentLists(), repo, branch, path] as const,
};
