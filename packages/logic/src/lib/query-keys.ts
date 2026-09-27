export const githubKeys = {
  all: ["github"] as const,

  token: () => [...githubKeys.all, "token"] as const,

  repos: () => [...githubKeys.all, "repos"] as const,

  branches: (repo: string) => [...githubKeys.all, "branches", repo] as const,

  contentLists: () => [...githubKeys.all, "content"] as const,
  contentList: (repo: string, branch: string, path: string) =>
    [...githubKeys.contentLists(), repo, branch, path] as const,
};
