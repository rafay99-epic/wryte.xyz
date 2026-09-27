"use node";

import { Octokit } from "@octokit/rest";
import { mapGithubError, throwMediaError } from "./errors";

export interface GhRepoSpec {
  owner: string;
  repo: string;
  branch?: string;
  mediaPath: string;
}

export interface GhUploadResult {
  url: string;
  externalId: string;
  bytes: number;
  filename: string;
  mime: string;
  sha: string;
}

export interface GhListItem {
  externalId: string;
  filename: string;
  size: number;
  url: string;
  sha: string;
}

export function parseRepoString(repoString: string): {
  owner: string;
  repo: string;
} {
  const parts = repoString.split("/");
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    throw new Error(
      `Invalid repo format: "${repoString}". Expected "owner/repo".`,
    );
  }
  return { owner: parts[0], repo: parts[1] };
}

function computeMediaPaths(
  mediaPath: string,
  filename: string,
): { repoPath: string; urlPath: string } {
  const repoPath = `${mediaPath}/${filename}`;
  const urlBase = mediaPath.startsWith("public/")
    ? mediaPath.slice("public/".length)
    : mediaPath;
  const urlPath = `/${urlBase}/${filename}`;
  return { repoPath, urlPath };
}

export async function uploadOne(
  token: string,
  spec: GhRepoSpec,
  file: { buffer: Buffer; mime: string; filename: string },
): Promise<GhUploadResult> {
  const octokit = new Octokit({ auth: token });
  const branch = spec.branch ?? "main";
  const { repoPath, urlPath } = computeMediaPaths(
    spec.mediaPath,
    file.filename,
  );
  const base64 = file.buffer.toString("base64");

  try {
    let existingSha: string | undefined;
    try {
      const probe = await octokit.repos.getContent({
        owner: spec.owner,
        repo: spec.repo,
        path: repoPath,
        ref: branch,
      });
      if (!Array.isArray(probe.data) && probe.data.type === "file") {
        existingSha = probe.data.sha;
      }
    } catch (e: unknown) {
      if ((e as { status?: number }).status !== 404) throw e;
    }

    const res = await octokit.repos.createOrUpdateFileContents({
      owner: spec.owner,
      repo: spec.repo,
      path: repoPath,
      message: `Upload media: ${file.filename}`,
      content: base64,
      branch,
      ...(existingSha ? { sha: existingSha } : {}),
    });

    const newSha = res.data.content?.sha;
    if (!newSha) {
      throw new Error("GitHub API did not return a file SHA");
    }
    return {
      url: urlPath,
      externalId: repoPath,
      bytes: file.buffer.byteLength,
      filename: file.filename,
      mime: file.mime,
      sha: newSha,
    };
  } catch (err) {
    throwMediaError(
      {
        code: mapGithubError(err),
        message:
          (err as { message?: string })?.message ?? "GitHub upload failed",
        provider: "github",
        operation: "upload",
      },
      err,
    );
  }
}

export async function listFiles(
  token: string,
  spec: GhRepoSpec,
): Promise<GhListItem[]> {
  const octokit = new Octokit({ auth: token });
  const branch = spec.branch ?? "main";
  try {
    const res = await octokit.repos.getContent({
      owner: spec.owner,
      repo: spec.repo,
      path: spec.mediaPath,
      ref: branch,
    });
    if (!Array.isArray(res.data)) {
      return [];
    }
    return res.data
      .filter((e) => e.type === "file")
      .map((entry) => {
        const { urlPath } = computeMediaPaths(spec.mediaPath, entry.name);
        return {
          externalId: entry.path,
          filename: entry.name,
          size: entry.size,
          url: urlPath,
          sha: entry.sha,
        };
      });
  } catch (err) {
    if ((err as { status?: number }).status === 404) {
      return [];
    }
    throwMediaError(
      {
        code: mapGithubError(err),
        message: (err as { message?: string })?.message ?? "GitHub list failed",
        provider: "github",
        operation: "list",
      },
      err,
    );
  }
}

export async function deleteFile(
  token: string,
  spec: GhRepoSpec,
  repoPath: string,
  sha: string,
): Promise<void> {
  const octokit = new Octokit({ auth: token });
  const branch = spec.branch ?? "main";
  try {
    await octokit.repos.deleteFile({
      owner: spec.owner,
      repo: spec.repo,
      path: repoPath,
      message: `Delete media: ${repoPath.split("/").pop() ?? repoPath}`,
      sha,
      branch,
    });
  } catch (err) {
    throwMediaError(
      {
        code: mapGithubError(err),
        message:
          (err as { message?: string })?.message ?? "GitHub delete failed",
        provider: "github",
        operation: "delete",
      },
      err,
    );
  }
}

export async function ping(
  token: string,
  spec: { owner: string; repo: string },
): Promise<void> {
  const octokit = new Octokit({ auth: token });
  try {
    await octokit.repos.get({ owner: spec.owner, repo: spec.repo });
  } catch (err) {
    throwMediaError(
      {
        code: mapGithubError(err),
        message: (err as { message?: string })?.message ?? "GitHub ping failed",
        provider: "github",
        operation: "ping",
      },
      err,
    );
  }
}

export { computeMediaPaths };
