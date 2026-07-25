/**
 * Shared helper functions for GitHub API routes.
 * Centralizes auth token retrieval and common parsing utilities
 * so individual route files stay focused on their specific logic.
 */

import { auth, clerkClient } from "@clerk/nextjs/server";

/**
 * Retrieves the current user's GitHub OAuth access token via Clerk.
 *
 * Uses a discriminated union return type so callers can check for errors
 * without try/catch — if `"error" in result`, auth failed; otherwise
 * `result.token` is the valid GitHub token.
 *
 * This is the single source of truth for GitHub auth across all API routes.
 */
export async function getGithubToken(): Promise<
  { token: string } | { error: string }
> {
  // Clerk's auth() reads the session from the request cookie
  const { userId } = await auth();

  if (!userId) {
    return { error: "Not authenticated" };
  }

  // Look up the OAuth token Clerk stored when the user connected GitHub.
  // The provider name is "github" — the legacy "oauth_" prefix is deprecated
  // and will be removed in the next Clerk major release.
  const client = await clerkClient();
  const tokens = await client.users.getUserOauthAccessToken(userId, "github");

  const token = tokens.data[0]?.token;

  if (!token) {
    return { error: "GitHub account not connected" };
  }

  return { token };
}

// NOTE: frontmatter type inference now lives in the detection engine at
// `src/lib/frontmatter-detection/infer.ts` (name-registry aware, used by the
// detect-frontmatter route). This file keeps only GitHub auth/repo helpers.

/**
 * Splits a "owner/repo" string into its component parts.
 * Throws if the format is invalid, so callers should wrap in try/catch.
 *
 * @example parseRepoString("octocat/hello-world") // { owner: "octocat", repo: "hello-world" }
 */
export function parseRepoString(repo: string): { owner: string; repo: string } {
  const parts = repo.split("/");
  const owner = parts[0];
  const repoName = parts[1];

  if (!owner || !repoName) {
    throw new Error(`Invalid repo format: "${repo}". Expected "owner/repo".`);
  }

  return { owner, repo: repoName };
}
