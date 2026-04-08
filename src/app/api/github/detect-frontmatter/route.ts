/**
 * GitHub Frontmatter Detection API Route
 *
 * Auto-detects the frontmatter schema from an existing content directory.
 * Instead of making users manually configure every field, this endpoint:
 * 1. Lists files in the given content directory on GitHub.
 * 2. Finds the first .md/.mdx file (recursing into subdirectories if needed).
 * 3. Parses its YAML frontmatter with gray-matter.
 * 4. Infers field types (string, date, boolean, tags, etc.) from the values.
 * 5. Returns a FrontmatterField[] array the client can use as a schema template.
 */

import { Octokit } from "@octokit/rest";
import matter from "gray-matter";
import { NextResponse } from "next/server";
import {
  getGithubToken,
  inferFieldType,
  parseRepoString,
} from "@/lib/github-helpers";

interface DetectRequest {
  repo: string;
  branch: string;
  contentPath: string;
}

interface FrontmatterField {
  name: string;
  type: string;
  required: boolean;
  defaultValue: string;
  options: string;
}

type GitHubItem = { name: string; path: string; type: string };

/**
 * Recursively searches for the first markdown file in a GitHub directory.
 * Checks direct children first, then recurses into subdirectories (max 3 levels deep).
 */
async function findMarkdownFile(
  octokit: Octokit,
  owner: string,
  repo: string,
  path: string,
  branch: string,
  depth = 0,
): Promise<GitHubItem | null> {
  if (depth > 3) return null; // Safety limit to avoid deep recursion

  let dirContents: unknown;
  try {
    const dirResponse = await octokit.repos.getContent({
      owner,
      repo,
      path,
      ref: branch,
    });
    dirContents = dirResponse.data;
  } catch {
    return null;
  }

  if (!Array.isArray(dirContents)) return null;

  const items = dirContents as GitHubItem[];

  // First, look for markdown files at this level
  const mdFile = items.find(
    (file) =>
      file.type === "file" &&
      (file.name.endsWith(".md") || file.name.endsWith(".mdx")),
  );
  if (mdFile) return mdFile;

  // If no markdown files found, recurse into subdirectories
  const subdirs = items.filter((item) => item.type === "dir");
  for (const subdir of subdirs) {
    const found = await findMarkdownFile(
      octokit,
      owner,
      repo,
      subdir.path,
      branch,
      depth + 1,
    );
    if (found) return found;
  }

  return null;
}

/**
 * Detects frontmatter fields by sampling the first markdown file in a content directory.
 * Expects JSON body with { repo, branch, contentPath }.
 * Returns { fields, sourceFile } on success or { fields: null, error } on failure.
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as DetectRequest;
    const { repo, branch, contentPath } = body;

    if (!repo || !branch || !contentPath) {
      return NextResponse.json(
        {
          fields: null,
          error: "Missing required fields: repo, branch, contentPath",
        },
        { status: 400 },
      );
    }

    const tokenResult = await getGithubToken();

    if ("error" in tokenResult) {
      return NextResponse.json(
        { fields: null, error: tokenResult.error },
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
          fields: null,
          error: `Invalid repo format: "${repo}". Expected "owner/repo".`,
        },
        { status: 400 },
      );
    }

    // Step 1: Verify the content path exists and is a directory
    let dirContents: unknown;
    try {
      const dirResponse = await octokit.repos.getContent({
        owner: parsed.owner,
        repo: parsed.repo,
        path: contentPath,
        ref: branch,
      });
      dirContents = dirResponse.data;
    } catch {
      return NextResponse.json(
        {
          fields: null,
          error: `Content path "${contentPath}" not found in ${repo} on branch "${branch}".`,
        },
        { status: 404 },
      );
    }

    // GitHub returns an object (not array) when the path points to a single file
    if (!Array.isArray(dirContents)) {
      // If it's a single markdown file, use it directly
      const singleFile = dirContents as {
        name: string;
        path: string;
        type: string;
        content?: string;
      };
      if (
        singleFile.type === "file" &&
        (singleFile.name.endsWith(".md") || singleFile.name.endsWith(".mdx"))
      ) {
        // Use this file directly
        const fileData = dirContents as { content?: string; path: string };
        if (!fileData.content) {
          return NextResponse.json(
            { fields: null, error: "Unable to read file content." },
            { status: 500 },
          );
        }
        const fileContent = Buffer.from(fileData.content, "base64").toString(
          "utf-8",
        );
        const { data: frontmatter } = matter(fileContent);

        const fields: FrontmatterField[] = Object.entries(
          frontmatter as Record<string, unknown>,
        ).map(([name, value]) => ({
          name,
          type: inferFieldType(value, name),
          required: true,
          defaultValue: value != null ? String(value) : "",
          options: "",
        }));

        return NextResponse.json({
          fields,
          sourceFile: fileData.path,
        });
      }

      return NextResponse.json(
        { fields: null, error: `"${contentPath}" is not a directory.` },
        { status: 400 },
      );
    }

    // Step 2: Find the first markdown file (recursing into subdirectories if needed)
    const items = dirContents as GitHubItem[];

    // First check top level
    let markdownFile = items.find(
      (file) =>
        file.type === "file" &&
        (file.name.endsWith(".md") || file.name.endsWith(".mdx")),
    );

    // If not found at top level, recurse into subdirectories
    if (!markdownFile) {
      const subdirs = items.filter((item) => item.type === "dir");
      for (const subdir of subdirs) {
        const found = await findMarkdownFile(
          octokit,
          parsed.owner,
          parsed.repo,
          subdir.path,
          branch,
          1,
        );
        if (found) {
          markdownFile = found;
          break;
        }
      }
    }

    if (!markdownFile) {
      return NextResponse.json(
        {
          fields: null,
          error: `No .md or .mdx files found in "${contentPath}" or its subdirectories. Add a markdown file with frontmatter to enable detection.`,
        },
        { status: 404 },
      );
    }

    // Step 3: Fetch the raw file content (base64-encoded by GitHub API)
    const fileResponse = await octokit.repos.getContent({
      owner: parsed.owner,
      repo: parsed.repo,
      path: markdownFile.path,
      ref: branch,
    });

    const fileData = fileResponse.data;

    if (Array.isArray(fileData) || !("content" in fileData)) {
      return NextResponse.json(
        { fields: null, error: "Unable to read file content." },
        { status: 500 },
      );
    }

    // Step 4: Decode from base64 and parse YAML frontmatter
    const fileContent = Buffer.from(fileData.content, "base64").toString(
      "utf-8",
    );
    const { data: frontmatter } = matter(fileContent);

    if (!frontmatter || Object.keys(frontmatter).length === 0) {
      return NextResponse.json(
        {
          fields: null,
          error: `Found "${markdownFile.path}" but it has no frontmatter. Add YAML frontmatter between --- delimiters.`,
        },
        { status: 404 },
      );
    }

    // Step 5: Convert each frontmatter key into a typed field definition.
    // All detected fields default to required; the user can adjust in the UI.
    const fields: FrontmatterField[] = Object.entries(
      frontmatter as Record<string, unknown>,
    ).map(([name, value]) => ({
      name,
      type: inferFieldType(value, name),
      required: true,
      defaultValue: value != null ? String(value) : "",
      options: "",
    }));

    return NextResponse.json({
      fields,
      sourceFile: markdownFile.path,
    });
  } catch (_err: unknown) {
    return NextResponse.json(
      { fields: null, error: "Failed to detect frontmatter" },
      { status: 500 },
    );
  }
}
