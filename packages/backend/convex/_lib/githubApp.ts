"use node";

import { createSign } from "node:crypto";
import { Octokit } from "@octokit/rest";

export function isGithubAppConfigured(): boolean {
  return Boolean(
    process.env["GITHUB_APP_ID"] && process.env["GITHUB_APP_PRIVATE_KEY"],
  );
}

function base64url(input: string | Buffer): string {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function createAppJwt(): string {
  const appId = process.env["GITHUB_APP_ID"];
  const privateKey = process.env["GITHUB_APP_PRIVATE_KEY"]?.replace(
    /\\n/g,
    "\n",
  );
  if (!appId || !privateKey) {
    throw new Error("GitHub App env vars not configured");
  }

  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = base64url(
    JSON.stringify({ iat: now - 60, exp: now + 9 * 60, iss: appId }),
  );
  const signer = createSign("RSA-SHA256");
  signer.update(`${header}.${payload}`);
  const signature = base64url(signer.sign(privateKey));
  return `${header}.${payload}.${signature}`;
}

export async function getInstallationOctokit(
  owner: string,
  repo: string,
): Promise<Octokit | null> {
  if (!isGithubAppConfigured()) {
    return null;
  }
  try {
    const jwt = createAppJwt();
    const appClient = new Octokit();
    const { data: installation } = await appClient.request(
      "GET /repos/{owner}/{repo}/installation",
      { owner, repo, headers: { authorization: `Bearer ${jwt}` } },
    );
    const { data: tokenData } = await appClient.request(
      "POST /app/installations/{installation_id}/access_tokens",
      {
        installation_id: installation.id,
        headers: { authorization: `Bearer ${jwt}` },
      },
    );
    return new Octokit({ auth: tokenData.token });
  } catch (error: unknown) {
    const err = error as { status?: number; message?: string };
    if (err.status !== 404) {
      console.warn(
        `[githubApp] installation token failed (status=${err.status ?? "?"}): ${err.message ?? "unknown"} — falling back to user token`,
      );
    }
    return null;
  }
}

export type CommitAuthor = { name: string; email: string };

export async function resolveCommitClient(opts: {
  userToken: string;
  project: { verifiedCommits?: boolean | undefined };
  owner: string;
  repo: string;
  githubUsername?: string | undefined;
}): Promise<{ octokit: Octokit; commitAuthor: CommitAuthor | null }> {
  const userOctokit = new Octokit({ auth: opts.userToken });
  if (!opts.project.verifiedCommits) {
    return { octokit: userOctokit, commitAuthor: null };
  }
  const appOctokit = await getInstallationOctokit(opts.owner, opts.repo);
  if (!appOctokit) {
    console.info(
      `[githubApp] verifiedCommits enabled but App unavailable for ${opts.owner}/${opts.repo} — falling back to user token`,
    );
    return { octokit: userOctokit, commitAuthor: null };
  }
  const commitAuthor = await resolveUserAuthor(appOctokit, opts.githubUsername);
  return { octokit: appOctokit, commitAuthor };
}

export async function resolveUserAuthor(
  octokit: Octokit,
  login: string | undefined,
): Promise<CommitAuthor | null> {
  if (!login) return null;
  try {
    const { data } = await octokit.request("GET /users/{username}", {
      username: login,
    });
    return {
      name: data.login,
      email: `${String(data.id)}+${data.login}@users.noreply.github.com`,
    };
  } catch {
    return null;
  }
}
