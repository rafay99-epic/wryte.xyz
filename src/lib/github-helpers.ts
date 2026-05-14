/**
 * Shared helper functions for GitHub API routes.
 * Centralizes auth token retrieval and common parsing utilities
 * so individual route files stay focused on their specific logic.
 */

import { auth, clerkClient } from "@clerk/nextjs/server";
import type { FrontmatterFieldType } from "@/types/frontmatter";

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

/**
 * Infers a frontmatter field type from its runtime value and optional key name.
 * Used during auto-detection to map existing frontmatter values
 * to the UI field types.
 *
 * Heuristics:
 * - boolean values -> "boolean"
 * - number values -> "number"
 * - arrays -> "tags"
 * - objects -> "json"
 * - ISO datetime strings (with T) -> "datetime"
 * - ISO date strings -> "date"
 * - hex color strings -> "color"
 * - URL strings -> "url"
 * - image-like key names or file extensions -> "image"
 * - slug/permalink key names -> "slug"
 * - long strings (100+ chars) -> "text" (textarea in UI)
 * - everything else -> "string" (single-line input)
 */
export function inferFieldType(
  value: unknown,
  key?: string,
): FrontmatterFieldType {
  if (typeof value === "boolean") {
    return "boolean";
  }

  if (typeof value === "number") {
    return "number";
  }

  if (Array.isArray(value)) {
    return "tags";
  }

  if (typeof value === "object" && value !== null) {
    return "json";
  }

  if (typeof value === "string") {
    // Full ISO datetime with time component
    if (/^\d{4}-\d{2}-\d{2}T/.test(value)) {
      return "datetime";
    }
    // Date-only
    if (ISO_DATE_RE.test(value)) {
      return "date";
    }
    // Hex color
    if (/^#[0-9a-fA-F]{3,8}$/.test(value)) {
      return "color";
    }
    // URLs
    if (/^https?:\/\//i.test(value)) {
      return "url";
    }
    // Image paths (common extensions or key name hints)
    const lowerKey = key?.toLowerCase() ?? "";
    if (
      lowerKey.includes("image") ||
      lowerKey.includes("avatar") ||
      lowerKey.includes("cover") ||
      lowerKey.includes("thumbnail") ||
      lowerKey.includes("hero") ||
      /\.(jpe?g|png|gif|webp|svg|avif)$/i.test(value)
    ) {
      return "image";
    }
    // Slug-like keys
    if (lowerKey === "slug" || lowerKey === "permalink") {
      return "slug";
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
