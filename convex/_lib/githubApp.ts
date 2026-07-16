/**
 * GitHub App ("wryte-xyz", App ID 4318946) helpers for verified commits.
 *
 * When a project enables `verifiedCommits` and the App is installed on the
 * target repo, publishes are committed with an installation access token —
 * the committer becomes `wryte-xyz[bot]` and GitHub shows a Verified badge
 * (GitHub signs commits created by App tokens). The document author is
 * preserved via an explicit git `author` so the user keeps their
 * contribution graph.
 *
 * Requires two Convex deployment env vars:
 *   GITHUB_APP_ID          — numeric App ID
 *   GITHUB_APP_PRIVATE_KEY — the App's private key PEM as downloaded from
 *                            GitHub ("BEGIN RSA PRIVATE KEY"); literal `\n`
 *                            escapes are accepted.
 *
 * Node runtime only (node:crypto) — import exclusively from "use node" files.
 */
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

/** Short-lived (9 min) RS256 JWT authenticating as the App itself. */
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
  // iat backdated 60s to absorb clock drift between us and GitHub.
  const payload = base64url(
    JSON.stringify({ iat: now - 60, exp: now + 9 * 60, iss: appId }),
  );
  const signer = createSign("RSA-SHA256");
  signer.update(`${header}.${payload}`);
  const signature = base64url(signer.sign(privateKey));
  return `${header}.${payload}.${signature}`;
}

/**
 * Returns an Octokit authenticated as the App's installation on the given
 * repo, or null when the App isn't installed there (or isn't configured) —
 * callers fall back to the user's own token so publishing never breaks.
 */
export async function getInstallationOctokit(
  owner: string,
  repo: string,
): Promise<Octokit | null> {
  if (!isGithubAppConfigured()) {
    return null;
  }
  try {
    // One JWT for both App-level calls; explicit Bearer header because a
    // plain Octokit `auth` string would send the `token` scheme instead.
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

/**
 * Picks the Octokit + git author for a publish commit.
 *
 * verifiedCommits off (or App not installed/configured) → the user's own
 * token, no author override — exactly the pre-Phase-3 behaviour, so
 * publishing never breaks on a missing installation. verifiedCommits on
 * with a live installation → App token (committer = wryte-xyz[bot],
 * Verified badge) and the user preserved as git author when resolvable.
 */
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

/**
 * Resolves the git author identity for a user when the bot is the committer,
 * using GitHub's generated noreply form so the user's avatar and
 * contribution graph still attach to the commit. Null when the login can't
 * be resolved — the commit then shows the bot as both author and committer.
 */
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
