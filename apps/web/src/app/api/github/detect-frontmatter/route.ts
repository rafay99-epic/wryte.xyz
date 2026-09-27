import { Octokit } from "@octokit/rest";
import {
  type ConfigFile,
  type DetectionResult,
  detectSchema,
  identifyFramework,
  type RawSampleFile,
} from "@wryte/logic/lib/frontmatter-detection/index";
import {
  hasConfig,
  MD_RE,
  normalizePath,
  SAMPLE_LIMIT,
  selectConfigEntries,
  selectSampleEntries,
} from "@wryte/logic/lib/frontmatter-detection/sampling";
import { NextResponse } from "next/server";
import {
  getGithubToken,
  parseRepoString,
} from "@/app/api/github/_lib/github-helpers";

type DetectRequest = {
  repo: string;
  branch: string;
  contentPath: string;
};

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

    const framework = identifyFramework(allPaths);

    let sampleEntries = selectSampleEntries(blobs, contentPath);
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

    const configEntries = selectConfigEntries(blobs, framework);
    const [configFiles, sampleFiles] = await Promise.all([
      fetchBlobs(octokit, owner, repoName, configEntries),
      fetchBlobs(octokit, owner, repoName, sampleEntries),
    ]);

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
      sourceFile: result.sources[0] ?? null,
    });
  } catch {
    return NextResponse.json(
      { fields: null, error: "Failed to detect frontmatter" },
      { status: 500 },
    );
  }
}

async function resolveCommitSha(
  octokit: Octokit,
  owner: string,
  repo: string,
  branch: string,
): Promise<string> {
  const { data } = await octokit.repos.getBranch({ owner, repo, branch });
  return data.commit.sha;
}

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
