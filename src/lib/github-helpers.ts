/**
 * Shared helper functions for GitHub API routes.
 * Centralizes auth token retrieval and common parsing utilities
 * so individual route files stay focused on their specific logic.
 */

import { auth, clerkClient } from "@clerk/nextjs/server";

// Matches ISO 8601 dates: "2024-01-15" or "2024-01-15T10:30:00Z" etc.
const ISO_DATE_RE =
  /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})?)?$/;

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

  // Look up the OAuth token Clerk stored when the user connected GitHub
  const client = await clerkClient();
  const tokens = await client.users.getUserOauthAccessToken(
    userId,
    "oauth_github",
  );

  const token = tokens.data[0]?.token;

  if (!token) {
    return { error: "GitHub account not connected" };
  }

  return { token };
}

/**
 * Infers a frontmatter field type from its runtime value.
 * Used during auto-detection to map existing frontmatter values
 * to the UI field types (string, text, boolean, date, tags).
 *
 * Heuristics:
 * - boolean values -> "boolean"
 * - arrays -> "tags" (assumed to be tag lists like ["go", "rust"])
 * - ISO date strings -> "date"
 * - long strings (100+ chars) -> "text" (textarea in UI)
 * - everything else -> "string" (single-line input)
 */
export function inferFieldType(value: unknown): string {
  if (typeof value === "boolean") {
    return "boolean";
  }

  if (Array.isArray(value)) {
    return "tags";
  }

  if (typeof value === "string") {
    if (ISO_DATE_RE.test(value)) {
      return "date";
    }
    // Long strings are likely descriptions/summaries — use a textarea
    if (value.length >= 100) {
      return "text";
    }
  }

  return "string";
}

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
