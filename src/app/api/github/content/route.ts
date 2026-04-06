/**
 * GitHub Content API Route
 *
 * Provides two endpoints for working with markdown content files in a GitHub repo:
 * - GET: Lists all .md/.mdx files in a given content directory.
 * - POST: Fetches a single file's raw content, parses its frontmatter, and returns
 *         the structured frontmatter + body separately for the editor UI.
 */

import { NextResponse } from "next/server";
import { Octokit } from "@octokit/rest";
import matter from "gray-matter";
import { getGithubToken, parseRepoString } from "@/lib/github-helpers";

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
        { files: [], error: `Invalid repo format: "${repo}". Expected "owner/repo".` },
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
      if (
        typeof err === "object" &&
        err !== null &&
        "status" in err &&
        (err as { status: number })["status"] === 404
      ) {
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
          file["type"] === "file" &&
          (file["name"].endsWith(".md") || file["name"].endsWith(".mdx")),
      )
      .map((file) => ({
        name: file["name"],
        path: file["path"],
        sha: file["sha"],
        size: file["size"],
      }));

    return NextResponse.json({ files });
  } catch (_err: unknown) {
    return NextResponse.json(
      { files: [], error: "Failed to list content files" },
      { status: 500 },
    );
  }
}

interface FetchFileRequest {
  repo: string;
  branch: string;
  path: string;
}

/**
 * Fetches a single markdown file's content from GitHub and parses it.
 * Expects JSON body with { repo, branch, path }.
 * Returns { frontmatter, content, sha } where frontmatter is the parsed YAML
 * metadata, content is the markdown body, and sha is needed for subsequent commits.
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as FetchFileRequest;
    const { repo, branch, path } = body;

    if (!repo || !branch || !path) {
      return NextResponse.json(
        { frontmatter: null, content: null, sha: null, error: "Missing required fields: repo, branch, path" },
        { status: 400 },
      );
    }

    const tokenResult = await getGithubToken();

    if ("error" in tokenResult) {
      return NextResponse.json(
        { frontmatter: null, content: null, sha: null, error: tokenResult.error },
        { status: 401 },
      );
    }

    const octokit = new Octokit({ auth: tokenResult.token });

    let parsed: { owner: string; repo: string };
    try {
      parsed = parseRepoString(repo);
    } catch {
      return NextResponse.json(
        { frontmatter: null, content: null, sha: null, error: `Invalid repo format: "${repo}". Expected "owner/repo".` },
        { status: 400 },
      );
    }

    let fileData: unknown;
    try {
      const fileResponse = await octokit.repos.getContent({
        owner: parsed.owner,
        repo: parsed.repo,
        path,
        ref: branch,
      });
      fileData = fileResponse.data;
    } catch (err: unknown) {
      if (
        typeof err === "object" &&
        err !== null &&
        "status" in err &&
        (err as { status: number })["status"] === 404
      ) {
        return NextResponse.json(
          { frontmatter: null, content: null, sha: null, error: `File "${path}" not found.` },
          { status: 404 },
        );
      }
      throw err;
    }

    // Guard against unexpected response shapes (e.g., directory listing or missing content)
    if (
      Array.isArray(fileData) ||
      typeof fileData !== "object" ||
      fileData === null ||
      !("content" in fileData)
    ) {
      return NextResponse.json(
        { frontmatter: null, content: null, sha: null, error: "Unable to read file content." },
        { status: 500 },
      );
    }

    const typedFileData = fileData as { content: string; sha: string };
    // GitHub API returns file content as base64 — decode it before parsing
    const rawContent = Buffer.from(typedFileData["content"], "base64").toString("utf-8");
    // gray-matter splits the YAML frontmatter block from the markdown body
    const { data: frontmatter, content } = matter(rawContent);

    return NextResponse.json({
      frontmatter: frontmatter as Record<string, unknown>,
      content,
      // sha is required by the GitHub API when updating file contents (optimistic concurrency)
      sha: typedFileData["sha"],
    });
  } catch (_err: unknown) {
    return NextResponse.json(
      { frontmatter: null, content: null, sha: null, error: "Failed to fetch file content" },
      { status: 500 },
    );
  }
}
