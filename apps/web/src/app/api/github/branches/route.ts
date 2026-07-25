/**
 * GitHub Branches API Route
 *
 * Lists the branches for a given repository, plus the repo's default branch.
 * Used by the project settings UI to populate a branch dropdown so users
 * don't have to memorise the exact branch name — they pick from a list,
 * and the default is auto-selected when the repo is first connected.
 *
 * Query params:
 *   - repo: "owner/name" string
 */

import { Octokit } from "@octokit/rest";
import { getGithubToken } from "@wryte/logic/lib/github-helpers";
import { type NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const repo = req.nextUrl.searchParams.get("repo");
  if (!repo?.includes("/")) {
    return NextResponse.json(
      { error: "Missing or malformed `repo` query parameter (owner/name)" },
      { status: 400 },
    );
  }

  const [owner, repoName] = repo.split("/", 2) as [string, string];

  try {
    const result = await getGithubToken();
    if ("error" in result) {
      return NextResponse.json(
        { error: result.error, connected: false },
        { status: 401 },
      );
    }

    const octokit = new Octokit({ auth: result.token });

    // Pull repo metadata (for the default branch) and the branch list in
    // parallel. 100 branches is the per_page cap; repos with more branches
    // will need pagination, but for the dropdown use case the first page is
    // virtually always enough.
    const [repoResp, branchesResp] = await Promise.all([
      octokit.repos.get({ owner, repo: repoName }),
      octokit.repos.listBranches({ owner, repo: repoName, per_page: 100 }),
    ]);

    const branches = branchesResp.data.map((b) => b.name);
    const defaultBranch = repoResp.data.default_branch;

    return NextResponse.json({ branches, defaultBranch });
  } catch (err: unknown) {
    if (err instanceof Error && "status" in err) {
      const status = (err as { status?: number }).status;
      if (status === 404) {
        return NextResponse.json(
          { error: "Repository not found or you don't have access to it" },
          { status: 404 },
        );
      }
      if (status === 401) {
        return NextResponse.json(
          { error: "GitHub account not connected", connected: false },
          { status: 401 },
        );
      }
    }
    return NextResponse.json(
      { error: "Failed to fetch branches" },
      { status: 500 },
    );
  }
}
