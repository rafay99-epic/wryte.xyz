/**
 * GitHub Repos API Route
 *
 * Lists the authenticated user's GitHub repositories. Uses the OAuth token
 * stored in Clerk to authenticate with the GitHub API via Octokit.
 * Only returns repos owned by the user (not collaborator/org repos),
 * sorted by most recently updated.
 */

import { Octokit } from "@octokit/rest";
import { getGithubToken } from "@wryte/logic/lib/github-helpers";
import { NextResponse } from "next/server";

/**
 * Fetches up to 100 of the user's own GitHub repos, sorted by last update.
 * Returns a simplified repo object with only the fields the client needs.
 */
export async function GET() {
  try {
    const result = await getGithubToken();

    if ("error" in result) {
      return NextResponse.json(
        { error: result.error, connected: false },
        { status: 401 },
      );
    }

    const octokit = new Octokit({ auth: result.token });

    // Fetch only user-owned repos, sorted by update time for relevance
    const response = await octokit.repos.listForAuthenticatedUser({
      sort: "updated",
      per_page: 100,
      type: "owner",
    });

    // Map to a minimal shape so we don't leak unnecessary GitHub data to the client
    const repos = response.data.map((repo) => ({
      fullName: repo.full_name,
      name: repo.name,
      defaultBranch: repo.default_branch,
      description: repo.description ?? null,
      private: repo.private,
      updatedAt: repo.updated_at ?? "",
    }));

    return NextResponse.json({ repos });
  } catch (err: unknown) {
    // GitHub returns 401 when the OAuth token is revoked or expired
    if (err instanceof Error && "status" in err && err.status === 401) {
      return NextResponse.json(
        { error: "GitHub account not connected", connected: false },
        { status: 401 },
      );
    }

    return NextResponse.json(
      { error: "Failed to fetch repositories" },
      { status: 500 },
    );
  }
}
