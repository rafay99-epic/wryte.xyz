import { Octokit } from "@octokit/rest";
import { NextResponse } from "next/server";
import { getGithubToken } from "@/app/api/github/_lib/github-helpers";
import { githubStatus } from "@/app/api/github/_lib/github-status";

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

    const response = await octokit.repos.listForAuthenticatedUser({
      sort: "updated",
      per_page: 100,
      type: "owner",
    });

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
    if (githubStatus(err) === 401) {
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
