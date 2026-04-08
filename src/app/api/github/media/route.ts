/**
 * GitHub Media API Route
 *
 * Lists all media files (images, videos, SVGs) in a GitHub repo's media directory.
 * Supports recursive scanning of subdirectories.
 *
 * GET: Lists media files with their download URLs.
 * Query params: repo (owner/repo), branch (defaults to "main"), path (media directory path).
 */

import { Octokit } from "@octokit/rest";
import { NextResponse } from "next/server";
import { getGithubToken, parseRepoString } from "@/lib/github-helpers";

/** File extensions recognized as media. */
const MEDIA_EXTENSIONS = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".svg",
  ".ico",
  ".bmp",
  ".avif",
  ".mp4",
  ".webm",
  ".mov",
]);

function isMediaFile(name: string): boolean {
  const ext = name.slice(name.lastIndexOf(".")).toLowerCase();
  return MEDIA_EXTENSIONS.has(ext);
}

interface MediaFile {
  name: string;
  path: string;
  sha: string;
  size: number;
  /** Raw GitHub URL for direct embedding. */
  downloadUrl: string;
}

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

    // Use the Git Trees API with recursive=true to get all files in the media directory
    // First, get the tree SHA for the branch
    let treeSha: string;
    try {
      const refRes = await octokit.git.getRef({
        owner: parsed.owner,
        repo: parsed.repo,
        ref: `heads/${branch}`,
      });
      const commitSha = refRes.data.object.sha;
      const commitRes = await octokit.git.getCommit({
        owner: parsed.owner,
        repo: parsed.repo,
        commit_sha: commitSha,
      });
      treeSha = commitRes.data.tree.sha;
    } catch {
      return NextResponse.json({ files: [] });
    }

    // Get the full recursive tree
    let treeItems: Array<{
      path?: string;
      sha?: string;
      size?: number;
      type?: string;
    }>;
    try {
      const treeRes = await octokit.git.getTree({
        owner: parsed.owner,
        repo: parsed.repo,
        tree_sha: treeSha,
        recursive: "true",
      });
      treeItems = treeRes.data.tree;
    } catch {
      return NextResponse.json({ files: [] });
    }

    // Filter to media files under the specified path
    const normalizedPath = path.endsWith("/") ? path : `${path}/`;
    const files: MediaFile[] = [];

    for (const item of treeItems) {
      if (
        item.type === "blob" &&
        item.path &&
        item.path.startsWith(normalizedPath) &&
        isMediaFile(item.path)
      ) {
        const fileName = item.path.slice(item.path.lastIndexOf("/") + 1);
        files.push({
          name: fileName,
          path: item.path,
          sha: item.sha ?? "",
          size: item.size ?? 0,
          downloadUrl: `https://raw.githubusercontent.com/${parsed.owner}/${parsed.repo}/${branch}/${item.path}`,
        });
      }
    }

    // Sort by path alphabetically
    files.sort((a, b) => a.path.localeCompare(b.path));

    return NextResponse.json({ files });
  } catch {
    return NextResponse.json(
      { files: [], error: "Failed to list media files" },
      { status: 500 },
    );
  }
}
