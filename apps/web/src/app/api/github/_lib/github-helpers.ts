import { auth, clerkClient } from "@clerk/nextjs/server";

export async function getGithubToken(): Promise<
  { token: string } | { error: string }
> {
  const { userId } = await auth();

  if (!userId) {
    return { error: "Not authenticated" };
  }

  const client = await clerkClient();
  const tokens = await client.users.getUserOauthAccessToken(userId, "github");

  const token = tokens.data[0]?.token;

  if (!token) {
    return { error: "GitHub account not connected" };
  }

  return { token };
}

export function parseRepoString(repo: string): { owner: string; repo: string } {
  const parts = repo.split("/");
  const owner = parts[0];
  const repoName = parts[1];

  if (!owner || !repoName) {
    throw new Error(`Invalid repo format: "${repo}". Expected "owner/repo".`);
  }

  return { owner, repo: repoName };
}
