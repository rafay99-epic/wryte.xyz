/**
 * GitHub Content API Route
 *
 * GET: Lists all .md/.mdx files in a given content directory of a GitHub repo.
 */

import { Octokit } from "@octokit/rest";
import {
  getGithubToken,
  parseRepoString,
} from "@wryte/logic/lib/github-helpers";
import { NextResponse } from "next/server";
import { githubStatus } from "@/app/api/github/_lib/github-status";

/**
 * Lists all markdown (.md/.mdx) files in a content directory.
 * Query params: repo (owner/repo), branch (defaults to "main"), path (directory path).
 * Returns { files: Array<{ name, path, sha, size }> }.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const repo = searchParams.get("repo");
    const branch = searchParams.get("branch") ?? "main";
    const path = searchParams.get("path");

    if (!repo || !path) {
      return NextResponse.json(
        { files: [], error: "Missing required query params: repo, path" },
        { status: 400 },
      );
    }

    const tokenResult = await getGithubToken();

    if ("error" in tokenResult) {
      return NextResponse.json(
        { files: [], error: tokenResult.error },
        { status: 401 },
      );
    }

    const octokit = new Octokit({ auth: tokenResult.token });

    let parsed: { owner: string; repo: string };
    try {
      parsed = parseRepoString(repo);
    } catch {
      return NextResponse.json(
        {
          files: [],
          error: `Invalid repo format: "${repo}". Expected "owner/repo".`,
        },
        { status: 400 },
      );
    }

    let dirContents: unknown;
    try {
      const dirResponse = await octokit.repos.getContent({
        owner: parsed.owner,
        repo: parsed.repo,
        path,
        ref: branch,
      });
      dirContents = dirResponse.data;
    } catch (err: unknown) {
      // A 404 means the directory doesn't exist yet — return empty list rather than error,
      // since the user may not have created content yet
      if (githubStatus(err) === 404) {
        return NextResponse.json({ files: [] });
      }
      throw err;
    }

    // GitHub returns an object (not array) when the path is a file, not a directory
    if (!Array.isArray(dirContents)) {
      return NextResponse.json(
        { files: [], error: `"${path}" is not a directory.` },
        { status: 400 },
      );
    }

    // Filter to only markdown files and return a minimal payload
    const files = (
      dirContents as Array<{
        name: string;
        path: string;
        sha: string;
        size: number;
        type: string;
      }>
    )
      .filter(
        (file) =>
          file.type === "file" &&
          (file.name.endsWith(".md") || file.name.endsWith(".mdx")),
      )
      .map((file) => ({
        name: file.name,
        path: file.path,
        sha: file.sha,
        size: file.size,
      }));

    return NextResponse.json({ files });
  } catch (_err: unknown) {
    return NextResponse.json(
      { files: [], error: "Failed to list content files" },
      { status: 500 },
    );
  }
}
