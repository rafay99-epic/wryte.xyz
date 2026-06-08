/**
 * GitHub Frontmatter Detection API Route
 *
 * Auto-detects a project's frontmatter schema from an existing content repo.
 * Unlike the old "sample the first markdown file" approach (which inferred a
 * field's type from a single value and mistyped list fields like `tags`), this
 * route feeds a framework-aware detection engine:
 *
 *   1. ONE recursive Git Trees API call enumerates the whole repo (cheap +
 *      scalable — replaces N directory walks).
 *   2. The framework is identified from the file tree (Astro/Hugo/Next/Jekyll/…).
 *   3. The framework's authoritative config (Astro Zod schema, Contentlayer
 *      fields, Hugo taxonomies, Jekyll defaults) is fetched if present.
 *   4. A BOUNDED, parallel sample of real posts is fetched.
 *   5. `detectSchema()` merges config (authoritative) with multi-file sample
 *      aggregation (majority type + required-by-frequency).
 *
 * Each request uses the caller's own GitHub token, so there's no shared
 * rate-limit bottleneck under concurrency.
 */

import { Octokit } from "@octokit/rest";
import { NextResponse } from "next/server";
import {
  type ConfigFile,
  configCandidatePaths,
  type DetectionResult,
  detectSchema,
  identifyFramework,
  type RawSampleFile,
} from "@/lib/frontmatter-detection";
import { getGithubToken, parseRepoString } from "@/lib/github-helpers";

type DetectRequest = {
  repo: string;
  branch: string;
  contentPath: string;
};

/** Hard caps that keep a single detection cheap regardless of repo size. */
const SAMPLE_LIMIT = 12;
const CONFIG_LIMIT = 4;

type TreeEntry = {
  path?: string;
  type?: string;
  sha?: string;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as DetectRequest;
    const repo = body.repo?.trim();
    const branch = body.branch?.trim();
    const contentPath = normalizePath(body.contentPath ?? "");

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

    let owner: string;
    let repoName: string;
    try {
      const parsed = parseRepoString(repo);
      owner = parsed.owner;
      repoName = parsed.repo;
    } catch {
      return NextResponse.json(
        {
          fields: null,
          error: `Invalid repo format: "${repo}". Expected "owner/repo".`,
        },
        { status: 400 },
      );
    }

    const octokit = new Octokit({ auth: tokenResult.token });

    // 1. Enumerate the repo with a single recursive tree call.
    let entries: TreeEntry[];
    let truncated = false;
    try {
      const commitSha = await resolveCommitSha(
        octokit,
        owner,
        repoName,
        branch,
      );
      const tree = await octokit.git.getTree({
        owner,
        repo: repoName,
        tree_sha: commitSha,
        recursive: "1",
      });
      entries = tree.data.tree as TreeEntry[];
      truncated = Boolean(tree.data.truncated);
    } catch {
      return NextResponse.json(
        {
          fields: null,
          error: `Repository "${repo}" or branch "${branch}" not found.`,
        },
        { status: 404 },
      );
    }

    const blobs = entries.filter(
      (e): e is Required<Pick<TreeEntry, "path" | "sha">> & TreeEntry =>
        e.type === "blob" &&
        typeof e.path === "string" &&
        typeof e.sha === "string",
    );
    const allPaths = entries
      .map((e) => e.path)
      .filter((p): p is string => typeof p === "string");

    // 2. Identify framework + pick the markdown files to sample.
    const framework = identifyFramework(allPaths);

    let sampleEntries = selectSampleEntries(blobs, contentPath);
    // Tree truncation only happens on very large repos; fall back to a direct
    // directory listing of the content path so detection still works.
    if (sampleEntries.length === 0 && truncated) {
      sampleEntries = await fallbackListing(
        octokit,
        owner,
        repoName,
        branch,
        contentPath,
      );
    }

    if (sampleEntries.length === 0 && !hasConfig(blobs, framework)) {
      return NextResponse.json(
        {
          fields: null,
          error: `No .md or .mdx files found under "${contentPath}". Add a markdown file with frontmatter, or check the content directory.`,
        },
        { status: 404 },
      );
    }

    // 3+4. Fetch config + sample contents in parallel (bounded).
    const configEntries = selectConfigEntries(blobs, framework);
    const [configFiles, sampleFiles] = await Promise.all([
      fetchBlobs(octokit, owner, repoName, configEntries),
      fetchBlobs(octokit, owner, repoName, sampleEntries),
    ]);

    // 5. Run the pure detection engine.
    const result: DetectionResult = detectSchema({
      framework,
      configFiles: configFiles as ConfigFile[],
      sampleFiles: sampleFiles as RawSampleFile[],
      contentPath,
    });

    if (result.fields.length === 0) {
      return NextResponse.json(
        {
          fields: null,
          error: `Found content under "${contentPath}" but no frontmatter to learn from. Add YAML/TOML frontmatter to a post.`,
        },
        { status: 404 },
      );
    }

    return NextResponse.json({
      fields: result.fields,
      framework: result.framework,
      frontmatterFormat: result.frontmatterFormat,
      basis: result.basis,
      sampledCount: result.sampledCount,
      sources: result.sources,
      // Back-compat with the existing wizard, which reads `sourceFile`.
      sourceFile: result.sources[0] ?? null,
    });
  } catch {
    return NextResponse.json(
      { fields: null, error: "Failed to detect frontmatter" },
      { status: 500 },
    );
  }
}

/** Strips leading/trailing slashes so tree paths join cleanly. */
function normalizePath(path: string): string {
  return path.trim().replace(/^\/+/, "").replace(/\/+$/, "");
}

/** Resolves a branch (or ref/sha) to a commit SHA for the tree call. */
async function resolveCommitSha(
  octokit: Octokit,
  owner: string,
  repo: string,
  branch: string,
): Promise<string> {
  const { data } = await octokit.repos.getBranch({ owner, repo, branch });
  return data.commit.sha;
}

const MD_RE = /\.mdx?$/i;

/**
 * Picks up to SAMPLE_LIMIT markdown blobs under the content path. Deprioritizes
 * Hugo section pages / template-ish files (`_index.md`, names starting with
 * `_`) so the sample reflects real posts.
 */
function selectSampleEntries(
  blobs: Array<{ path: string; sha: string }>,
  contentPath: string,
): Array<{ path: string; sha: string }> {
  const prefix = `${contentPath}/`;
  const candidates = blobs.filter(
    (b) =>
      (b.path === contentPath || b.path.startsWith(prefix)) &&
      MD_RE.test(b.path),
  );

  candidates.sort((a, b) => {
    const ra = sampleRank(a.path);
    const rb = sampleRank(b.path);
    if (ra !== rb) return ra - rb;
    return a.path.localeCompare(b.path);
  });

  return candidates.slice(0, SAMPLE_LIMIT);
}

function sampleRank(path: string): number {
  const name = path.slice(path.lastIndexOf("/") + 1).toLowerCase();
  if (name === "_index.md" || name === "index.md" || name === "index.mdx")
    return 2;
  if (name.startsWith("_")) return 1;
  return 0;
}

/** Config/archetype blobs that exist in the repo, capped. */
function selectConfigEntries(
  blobs: Array<{ path: string; sha: string }>,
  framework: ReturnType<typeof identifyFramework>,
): Array<{ path: string; sha: string }> {
  const candidates = new Set(configCandidatePaths(framework));
  if (candidates.size === 0) return [];
  const byPath = new Map(blobs.map((b) => [b.path, b]));
  const result: Array<{ path: string; sha: string }> = [];
  for (const path of candidates) {
    const blob = byPath.get(path);
    if (blob) result.push(blob);
    if (result.length >= CONFIG_LIMIT) break;
  }
  return result;
}

function hasConfig(
  blobs: Array<{ path: string; sha: string }>,
  framework: ReturnType<typeof identifyFramework>,
): boolean {
  return selectConfigEntries(blobs, framework).length > 0;
}

/** Fetches blob contents by SHA in parallel; skips any that fail. */
async function fetchBlobs(
  octokit: Octokit,
  owner: string,
  repo: string,
  entries: Array<{ path: string; sha: string }>,
): Promise<Array<{ path: string; content: string }>> {
  const results = await Promise.all(
    entries.map(async (entry) => {
      try {
        const { data } = await octokit.git.getBlob({
          owner,
          repo,
          file_sha: entry.sha,
        });
        const content = Buffer.from(data.content, "base64").toString("utf-8");
        return { path: entry.path, content };
      } catch {
        return null;
      }
    }),
  );
  return results.filter(
    (r): r is { path: string; content: string } => r !== null,
  );
}

/**
 * Truncated-tree fallback: list the content directory directly (non-recursive)
 * and return its markdown files. Bounded by SAMPLE_LIMIT.
 */
async function fallbackListing(
  octokit: Octokit,
  owner: string,
  repo: string,
  branch: string,
  contentPath: string,
): Promise<Array<{ path: string; sha: string }>> {
  try {
    const { data } = await octokit.repos.getContent({
      owner,
      repo,
      path: contentPath,
      ref: branch,
    });
    if (!Array.isArray(data)) return [];
    return data
      .filter((item) => item.type === "file" && MD_RE.test(item.name))
      .slice(0, SAMPLE_LIMIT)
      .map((item) => ({ path: item.path, sha: item.sha }));
  } catch {
    return [];
  }
}
