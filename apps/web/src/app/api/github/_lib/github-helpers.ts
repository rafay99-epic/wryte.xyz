import { auth, clerkClient } from "@clerk/nextjs/server";

const TOKEN_TTL_MS = 60_000;
const MAX_CACHED_TOKENS = 1000;
const tokenCache = new Map<string, { token: string; expiresAt: number }>();

function rememberToken(userId: string, token: string, now: number) {
  if (tokenCache.size >= MAX_CACHED_TOKENS) {
    for (const [key, entry] of tokenCache) {
      if (entry.expiresAt <= now) tokenCache.delete(key);
    }
    if (tokenCache.size >= MAX_CACHED_TOKENS) tokenCache.clear();
  }
  tokenCache.set(userId, { token, expiresAt: now + TOKEN_TTL_MS });
}

export async function getGithubToken(): Promise<
  { token: string } | { error: string }
> {
  const { userId } = await auth();

  if (!userId) {
    return { error: "Not authenticated" };
  }

  const now = Date.now();
  const cached = tokenCache.get(userId);
  if (cached && cached.expiresAt > now) {
    return { token: cached.token };
  }

  const client = await clerkClient();
  const tokens = await client.users.getUserOauthAccessToken(userId, "github");

  const token = tokens.data[0]?.token;

  if (!token) {
    tokenCache.delete(userId);
    return { error: "GitHub account not connected" };
  }

  rememberToken(userId, token, now);
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
