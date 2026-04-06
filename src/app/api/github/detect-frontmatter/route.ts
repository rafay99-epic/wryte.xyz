/**
 * GitHub Frontmatter Detection API Route
 *
 * Auto-detects the frontmatter schema from an existing content directory.
 * Instead of making users manually configure every field, this endpoint:
 * 1. Lists files in the given content directory on GitHub.
 * 2. Finds the first .md/.mdx file.
 * 3. Parses its YAML frontmatter with gray-matter.
 * 4. Infers field types (string, date, boolean, tags, etc.) from the values.
 * 5. Returns a FrontmatterField[] array the client can use as a schema template.
 */

import { NextResponse } from "next/server";
import { Octokit } from "@octokit/rest";
import matter from "gray-matter";
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
        { fields: null, error: "Missing required fields: repo, branch, contentPath" },
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
        { fields: null, error: `Invalid repo format: "${repo}". Expected "owner/repo".` },
        { status: 400 },
      );
    }

    // Step 1: Fetch the directory listing from GitHub
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
      return NextResponse.json(
        { fields: null, error: `"${contentPath}" is not a directory.` },
        { status: 400 },
      );
    }

    // Step 2: Find the first markdown file to use as a representative sample
    const markdownFile = (dirContents as Array<{ name: string; path: string; type: string }>).find(
      (file) =>
        file["type"] === "file" &&
        (file["name"].endsWith(".md") || file["name"].endsWith(".mdx")),
    );

    if (!markdownFile) {
      return NextResponse.json(
        {
          fields: null,
          error: `No .md or .mdx files found in "${contentPath}". Add a markdown file with frontmatter to enable detection.`,
        },
        { status: 404 },
      );
    }

    // Step 3: Fetch the raw file content (base64-encoded by GitHub API)
    const fileResponse = await octokit.repos.getContent({
      owner: parsed.owner,
      repo: parsed.repo,
      path: markdownFile["path"],
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
    const fileContent = Buffer.from(fileData["content"], "base64").toString(
      "utf-8",
    );
    const { data: frontmatter } = matter(fileContent);

    // Step 5: Convert each frontmatter key into a typed field definition.
    // All detected fields default to required; the user can adjust in the UI.
    const fields: FrontmatterField[] = Object.entries(
      frontmatter as Record<string, unknown>,
    ).map(([name, value]) => ({
      name,
      type: inferFieldType(value),
      required: true,
      defaultValue: value != null ? String(value) : "",
      options: "",
    }));

    return NextResponse.json({
      fields,
      sourceFile: markdownFile["path"],
    });
  } catch (_err: unknown) {
    return NextResponse.json(
      { fields: null, error: "Failed to detect frontmatter" },
      { status: 500 },
    );
  }
}
