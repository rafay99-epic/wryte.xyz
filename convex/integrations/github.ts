/**
 * GitHub integration actions for publishing documents and managing media.
 * Runs in a Node.js environment ("use node") because it depends on Octokit.
 *
 * Token sourcing: every action resolves the GitHub token server-side via
 * `getGithubToken(ctx, user._id)`. That helper checks Clerk OAuth first,
 * falls back to the WorkOS Vault PAT, and finally drains the legacy
 * plaintext field. There is no longer a "pass a token in" override —
 * `verifyRepoAccess` is the lone exception because it runs *before* a
 * user has anywhere to store a token (the connect wizard).
 *
 * Media migration at publish time has been removed — uploads now go
 * directly to the project's configured provider via
 * `convex/media/uploads.ts:upload`.
 */
"use node";

import { Octokit } from "@octokit/rest";
import { v } from "convex/values";
import { stringify as stringifyToml } from "smol-toml";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import type { ActionCtx } from "../_generated/server";
import { action, internalAction } from "../_generated/server";
import { getGithubToken } from "../_lib/auth";
import { coerceFrontmatterArrays } from "../_lib/frontmatter";
import { buildPublishedUrl } from "../_lib/publishedUrl";
import { getRateLimitKey, rateLimiter } from "../_lib/rateLimits";
import { importPool } from "../_pools/import";

/**
 * Shape returned by the single-file import path — shared by the public
 * `importFileFromGithub` action and the `_importOneFromGithubJob`
 * workpool job (both delegate to `importOneFile`). `documentId` is
 * typed `v.string()` (not `v.id`) because the underlying mutations
 * declare their return as `string`.
 */
const IMPORTED_FILE_RESULT = v.object({
  documentId: v.string(),
  title: v.string(),
  slug: v.string(),
});

/**
 * Assembles a complete markdown file with YAML frontmatter from structured data.
 * Handles quoting for strings that contain YAML-special characters, and supports
 * nested objects and arrays in the frontmatter values.
 */
function quoteYamlScalar(value: unknown): string {
  const s = String(value);
  if (
    s === "" ||
    s.includes("\n") ||
    s.includes(":") ||
    s.includes("#") ||
    s.includes("'") ||
    s.includes('"') ||
    s.startsWith(" ") ||
    s.endsWith(" ") ||
    s.startsWith("{") ||
    s.startsWith("[") ||
    /^(true|false|null|yes|no|\d[\d.eE+-]*)$/i.test(s)
  ) {
    if (s.includes("\n")) {
      return `|\n${s
        .split("\n")
        .map((line) => `  ${line}`)
        .join("\n")}`;
    }
    return `"${s.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
  }
  return s;
}

function serializeYamlEntry(
  key: string,
  value: unknown,
  indent: number,
): string[] {
  const prefix = "  ".repeat(indent);
  if (value === null || value === undefined) return [];

  if (typeof value === "boolean" || typeof value === "number") {
    return [`${prefix}${key}: ${value}`];
  }
  if (typeof value === "string") {
    const quoted = quoteYamlScalar(value);
    if (quoted.startsWith("|\n")) {
      const lines = quoted.split("\n");
      return [
        `${prefix}${key}: ${lines[0]}`,
        ...lines.slice(1).map((l) => `${prefix}${l}`),
      ];
    }
    return [`${prefix}${key}: ${quoted}`];
  }
  if (Array.isArray(value)) {
    // An empty block sequence (`key:` with no items) parses back as YAML null,
    // which breaks typed schemas like Astro's `z.array(...)`. Emit flow-style
    // `[]` so an empty list round-trips as an empty list.
    if (value.length === 0) return [`${prefix}${key}: []`];
    const result = [`${prefix}${key}:`];
    for (const item of value) {
      if (typeof item === "object" && item !== null && !Array.isArray(item)) {
        const entries = Object.entries(item as Record<string, unknown>);
        const first = entries[0];
        if (first) {
          const [firstKey, firstVal] = first;
          result.push(`${prefix}  - ${firstKey}: ${quoteYamlScalar(firstVal)}`);
          for (const [k, v] of entries.slice(1)) {
            result.push(`${prefix}    ${k}: ${quoteYamlScalar(v)}`);
          }
        }
      } else {
        result.push(`${prefix}  - ${quoteYamlScalar(item)}`);
      }
    }
    return result;
  }
  if (typeof value === "object") {
    const result = [`${prefix}${key}:`];
    for (const [subKey, subValue] of Object.entries(
      value as Record<string, unknown>,
    )) {
      result.push(...serializeYamlEntry(subKey, subValue, indent + 1));
    }
    return result;
  }
  return [`${prefix}${key}: ${quoteYamlScalar(value)}`];
}

function buildMarkdownFile(
  frontmatter: Record<string, unknown>,
  content: string,
): string {
  const yamlLines: string[] = [];

  for (const [key, value] of Object.entries(frontmatter)) {
    if (value === null || value === undefined) {
      continue;
    }

    yamlLines.push(...serializeYamlEntry(key, value, 0));
  }

  const yamlBlock = yamlLines.join("\n");
  return `---\n${yamlBlock}\n---\n\n${content}\n`;
}

/** Drops null/undefined keys — smol-toml's stringify throws on them. */
function stripNullish(
  frontmatter: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(frontmatter)) {
    if (value !== null && value !== undefined) out[key] = value;
  }
  return out;
}

/**
 * Builds the published file, honoring the project's frontmatter delimiter
 * format. Hugo and other TOML-frontmatter sites use `+++` fences; everyone else
 * uses YAML `---`. TOML serialization falls back to YAML if any value can't be
 * represented, so publishing never hard-fails on an exotic value.
 */
function buildContentFile(
  frontmatter: Record<string, unknown>,
  content: string,
  format: "yaml" | "toml" | undefined,
): string {
  if (format === "toml") {
    try {
      const toml = stringifyToml(stripNullish(frontmatter)).trim();
      return `+++\n${toml}\n+++\n\n${content}\n`;
    } catch {
      // Fall through to YAML on any serialization error.
    }
  }
  return buildMarkdownFile(frontmatter, content);
}

/**
 * Field names a project may use for the publish date. Order matters — the
 * first match wins, so `pubDate` is preferred over the generic `date`. Mirrors
 * the lookup in `src/lib/build-initial-frontmatter.ts` so the editor and the
 * publish action stay in sync.
 */
const PUB_DATE_FIELD_CANDIDATES = ["pubDate", "publishDate", "date"] as const;

/**
 * Finds the publish-date field in a project's frontmatter schema, if any.
 * Returns the field's `name` (which becomes the YAML key) and `type` (so the
 * caller can format the value as YYYY-MM-DD vs full ISO datetime). Returns
 * null when the schema can't be parsed or has no matching field — in that
 * case the publish action leaves whatever value the user already has.
 */
function findPubDateField(
  schemaJson: string | null | undefined,
): { name: string; type: "date" | "datetime" } | null {
  if (!schemaJson) return null;
  try {
    const fields = JSON.parse(schemaJson) as Array<{
      name: string;
      type: string;
    }>;
    if (!Array.isArray(fields)) return null;
    for (const candidate of PUB_DATE_FIELD_CANDIDATES) {
      const match = fields.find(
        (f) =>
          f.name === candidate && (f.type === "date" || f.type === "datetime"),
      );
      if (match)
        return { name: match.name, type: match.type as "date" | "datetime" };
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Decides whether to stamp the publish moment onto the pubDate field.
 *
 * We stamp when:
 *   - a scheduled publish passes an explicit `publishedAtMs` (the user chose
 *     that moment), OR
 *   - the document has no existing pubDate value (first publish).
 *
 * We DON'T stamp when the document already carries a pubDate — re-publishing an
 * already-dated post then preserves its original date. This makes re-publishing
 * an old post to fix its formatting safe: the date never moves.
 */
function shouldStampPubDate(
  docFrontmatter: Record<string, unknown>,
  pubDateFieldName: string,
  publishedAtMs?: number,
): boolean {
  if (publishedAtMs !== undefined) return true;
  const existing = docFrontmatter[pubDateFieldName];
  if (existing === undefined || existing === null) return true;
  return String(existing).trim() === "";
}

function getFileExtension(contentFormat?: string): string {
  return contentFormat === "mdx" ? ".mdx" : ".md";
}

/**
 * Parses an "owner/repo" string into its two components.
 * Throws a descriptive error if the format is invalid, since this is a common
 * user-input mistake that would otherwise cause cryptic GitHub API errors.
 */
function parseRepoString(repo: string): { owner: string; repo: string } {
  const parts = repo.split("/");
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    throw new Error(`Invalid repo format: "${repo}". Expected "owner/repo".`);
  }
  return { owner: parts[0], repo: parts[1] };
}

/**
 * Strips leading and trailing slashes from a repo-relative path. GitHub's
 * Contents API rejects paths with leading slashes (looks for a file literally
 * named "/src/..." which doesn't exist → 404), and a trailing slash on a
 * directory prefix would produce a double-slash when joined to a slug.
 *
 * Examples:
 *   "/src/content/blog"   → "src/content/blog"
 *   "src/content/blog/"   → "src/content/blog"
 *   "/src/content/blog/"  → "src/content/blog"
 *   ""                    → ""
 *   "/"                   → ""
 */
function normalizeRepoPath(path: string): string {
  return path.replace(/^\/+/, "").replace(/\/+$/, "");
}

/**
 * Joins a directory prefix and a filename into a clean repo-relative path,
 * gracefully handling missing/empty prefixes (root-of-repo posts).
 */
function joinRepoPath(prefix: string, filename: string): string {
  const cleanPrefix = normalizeRepoPath(prefix);
  return cleanPrefix ? `${cleanPrefix}/${filename}` : filename;
}

/**
 * Given a 404 from a Contents API write, walk back through the auth chain to
 * figure out *why* — GitHub returns 404 in three indistinguishable cases:
 *
 *   1. The repo doesn't exist or isn't visible to the token's user
 *      (different account, repo deleted/renamed, or private repo without
 *      proper scope grant).
 *   2. The token's user doesn't have write access (read-only collaborator).
 *   3. The token's OAuth scopes don't include `repo` — Clerk's default
 *      GitHub OAuth scope set is `read:user user:email`; without explicit
 *      configuration the token can't write anywhere.
 *
 * The branch on the original error path tells us which one. Returns a
 * caller-friendly message; callers throw it so it surfaces in the
 * "Publish failed" banner.
 */
/**
 * Stronger diagnostic for 404-on-PUT: checks whether the branch exists,
 * whether the branch is protected, and what scopes the token actually
 * has. Logged to the console only; not surfaced to the user.
 */
async function diagnoseBranchAndRepo(
  octokit: Octokit,
  owner: string,
  repoName: string,
  branch: string,
): Promise<{
  branchExists: boolean;
  defaultBranch: string | null;
  availableBranches: string[];
  branchProtected: boolean | "unknown";
  tokenScopes: string | null;
  acceptedScopes: string | null;
  authenticatedAs: string | null;
}> {
  let defaultBranch: string | null = null;
  let availableBranches: string[] = [];
  let branchExists = false;
  let branchProtected: boolean | "unknown" = "unknown";
  let tokenScopes: string | null = null;
  let acceptedScopes: string | null = null;
  let authenticatedAs: string | null = null;

  try {
    const me = await octokit.users.getAuthenticated();
    authenticatedAs = me.data.login;
    const xs = me.headers["x-oauth-scopes"];
    const xa = me.headers["x-accepted-oauth-scopes"];
    tokenScopes = typeof xs === "string" ? xs : null;
    acceptedScopes = typeof xa === "string" ? xa : null;
  } catch {
    // ignore
  }

  try {
    const r = await octokit.repos.get({ owner, repo: repoName });
    defaultBranch = r.data.default_branch;
  } catch {
    // ignore
  }

  try {
    const b = await octokit.repos.listBranches({
      owner,
      repo: repoName,
      per_page: 100,
    });
    availableBranches = b.data.map((x) => x.name);
    branchExists = availableBranches.includes(branch);
    const branchInfo = b.data.find((x) => x.name === branch);
    branchProtected = branchInfo?.protected ?? "unknown";
  } catch {
    // ignore
  }

  return {
    branchExists,
    defaultBranch,
    availableBranches,
    branchProtected,
    tokenScopes,
    acceptedScopes,
    authenticatedAs,
  };
}

async function describeWriteFailure(
  octokit: Octokit,
  owner: string,
  repoName: string,
): Promise<string> {
  // Who does GitHub think we are?
  let actingAs: string | null = null;
  let scopes: string | null = null;
  try {
    const me = await octokit.users.getAuthenticated();
    actingAs = me.data.login;
    // Octokit surfaces OAuth scopes on the response headers.
    const headerScopes = me.headers["x-oauth-scopes"];
    scopes = typeof headerScopes === "string" ? headerScopes : null;
  } catch {
    return "GitHub token is invalid or revoked — reconnect GitHub in Settings.";
  }

  // Can we see the repo at all?
  try {
    const r = await octokit.repos.get({ owner, repo: repoName });
    // We can see the repo. So failure is either branch missing or write perm.
    if (!r.data.permissions?.push) {
      return `Connected as @${actingAs}, but that account has no write access to ${owner}/${repoName}. Either grant push permission to @${actingAs} on the repo, or set a Personal Access Token with 'repo' scope in Settings.`;
    }
    return `Connected as @${actingAs} with write access to ${owner}/${repoName}, but the publish still 404'd — most likely the branch doesn't exist. Check the branch name in project settings.`;
  } catch {
    // Repo lookup failed → either the repo doesn't exist for this account
    // or the token can't even see it. Most common: insufficient OAuth scope.
    const scopeHint = scopes
      ? scopes.includes("repo")
        ? ""
        : ` (current OAuth scopes: \`${scopes}\` — missing \`repo\`)`
      : " (could not read OAuth scopes from GitHub response)";
    return `${owner}/${repoName} is not visible to GitHub user @${actingAs}${scopeHint}. Fixes: (a) add \`repo\` scope to your Clerk GitHub OAuth provider config and reconnect GitHub, (b) sign in with the GitHub account that owns this repo, or (c) set a Personal Access Token with \`repo\` scope in Settings.`;
  }
}

/**
 * Resolves the GitHub token for an action. Always goes through
 * `getGithubToken` so every action sees the same Clerk → vault → legacy
 * fallback. Throws a friendly message when nothing is available so the
 * UI can prompt the user to reconnect.
 */
async function resolveToken(
  ctx: ActionCtx,
  userId: Id<"users">,
): Promise<string> {
  const token = await getGithubToken(ctx, userId);
  if (!token) {
    throw new Error(
      "No GitHub access token available. Reconnect GitHub in Settings or set a Personal Access Token.",
    );
  }
  return token;
}

/**
 * Internal action that performs the actual GitHub commit for publishing a document.
 * Builds the markdown file from document content + frontmatter, then creates or
 * updates the file in the configured repository via the GitHub Contents API.
 *
 * @param args.documentId - The document to publish.
 */
export const publishToGithub = internalAction({
  args: {
    documentId: v.id("documents"),
    commitMessage: v.optional(v.string()),
    /**
     * Override the publish moment used to stamp the document's pubDate
     * field. The scheduling workflow passes the user's `scheduledAt` here
     * so the published frontmatter records when the user *wanted* the
     * post live, not when the workflow happened to fire (which can drift
     * a few seconds). When omitted, "now" is used.
     */
    publishedAtMs: v.optional(v.number()),
    socialPostText: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const document = await ctx.runQuery(internal.cms.documents.internalGet, {
      documentId: args.documentId,
    });
    if (!document) {
      throw new Error("Document not found");
    }

    const project = await ctx.runQuery(internal.cms.projects.internalGet, {
      projectId: document.projectId,
    });
    if (!project) {
      throw new Error("Project not found");
    }

    const user = await ctx.runQuery(internal.account.users.internalGet, {
      userId: project.userId,
    });
    if (!user) {
      throw new Error("User not found");
    }

    const token = await resolveToken(ctx, user._id);

    if (!project.githubRepo) {
      throw new Error("GitHub repository not configured for this project");
    }

    const { owner, repo } = parseRepoString(project.githubRepo);
    const branch = project.githubBranch ?? "main";
    const ext = getFileExtension(project.contentFormat);
    const filePath = joinRepoPath(
      project.contentPath ?? "content",
      `${document.slug}${ext}`,
    );

    const octokit = new Octokit({ auth: token });

    let frontmatterData: Record<string, unknown> = {
      title: document.title,
      date: new Date().toISOString(),
      draft: false,
    };

    let parsedDocFrontmatter: Record<string, unknown> = {};
    if (document.frontmatter) {
      try {
        parsedDocFrontmatter = JSON.parse(document.frontmatter) ?? {};
        frontmatterData = { ...frontmatterData, ...parsedDocFrontmatter };
      } catch {
        // If frontmatter JSON is invalid, use defaults only
      }
    }

    // The user's frontmatter spread above wins by design, but two fields
    // are publish-time side effects:
    //   - the schema's pubDate field is stamped with the publish moment ONLY on
    //     a first publish (the post has no date yet) or when a scheduled publish
    //     passes an explicit moment. Re-publishing an already-dated post
    //     preserves its original date — so fixing an old post never moves it.
    //   - draft flips to false because, well, we're publishing
    const publishMoment = new Date(args.publishedAtMs ?? Date.now());
    const pubDateField = findPubDateField(project.frontmatterSchema);
    if (
      pubDateField &&
      shouldStampPubDate(
        parsedDocFrontmatter,
        pubDateField.name,
        args.publishedAtMs,
      )
    ) {
      frontmatterData[pubDateField.name] =
        pubDateField.type === "date"
          ? publishMoment.toISOString().slice(0, 10)
          : publishMoment.toISOString();
    }
    frontmatterData["draft"] = false;

    // Guard: list-valued keys (tags/keywords/…) must serialize as arrays even
    // when the schema mistyped them as scalars — otherwise typed frameworks
    // (Astro's z.array, etc.) reject the build. See convex/_lib/frontmatter.ts.
    frontmatterData = coerceFrontmatterArrays(
      frontmatterData,
      project.frontmatterSchema,
    );

    const fileContent = buildContentFile(
      frontmatterData,
      document.content,
      project.frontmatterFormat,
    );
    const base64Content = Buffer.from(fileContent).toString("base64");

    const pathChanged =
      document.githubPath != null && document.githubPath !== filePath;
    let existingSha: string | undefined = pathChanged
      ? undefined
      : (document.githubSha ?? undefined);

    if (!existingSha) {
      try {
        const { data } = await octokit.repos.getContent({
          owner,
          repo,
          path: filePath,
          ref: branch,
        });
        if (!Array.isArray(data) && data.type === "file") {
          existingSha = data.sha;
        }
      } catch (error: unknown) {
        const err = error as { status?: number; message?: string };
        if (err.status !== 404) {
          throw new Error(
            `Failed to check existing file: ${err.message ?? "Unknown error"}`,
          );
        }
      }
    }

    const isUpdate = Boolean(existingSha);
    const commitMessage =
      args.commitMessage ||
      (isUpdate ? `Update ${document.title}` : `Add ${document.title}`);

    // Diagnostic: log the exact values we're about to send so when GitHub
    // 404s we have one log line telling us whether the bug is in branch,
    // path, repo, or SHA.
    console.info(
      `[publishToGithub] PUT owner=${owner} repo=${repo} branch=${JSON.stringify(branch)} path=${JSON.stringify(filePath)} existingSha=${existingSha ? "<set>" : "<none>"} contentBytes=${base64Content.length}`,
    );

    let response: Awaited<
      ReturnType<typeof octokit.repos.createOrUpdateFileContents>
    >;
    try {
      response = await octokit.repos.createOrUpdateFileContents({
        owner,
        repo,
        path: filePath,
        message: commitMessage,
        content: base64Content,
        branch,
        ...(existingSha ? { sha: existingSha } : {}),
      });
    } catch (error: unknown) {
      const err = error as { status?: number; message?: string };
      console.error(
        `[publishToGithub] error status=${err.status ?? "?"} message=${JSON.stringify(err.message ?? "?")}`,
      );
      if (err.status === 401) {
        throw new Error(
          "GitHub token expired or revoked. Please reconnect GitHub in settings.",
        );
      }
      if (err.status === 404) {
        // 404 on a Contents write is almost never "file not found" — GitHub
        // uses it to mask permission, scope, and visibility failures. Probe
        // the auth chain and surface a precise diagnosis.
        const diag = await diagnoseBranchAndRepo(octokit, owner, repo, branch);
        console.error(`[publishToGithub] post-404 diagnosis:`, diag);
        const why = await describeWriteFailure(octokit, owner, repo);
        throw new Error(
          `GitHub publish failed: ${why} (branch="${branch}", path="${filePath}")`,
        );
      }
      throw error;
    }

    const newSha = response.data.content?.sha;
    if (!newSha) {
      throw new Error("GitHub API did not return a file SHA");
    }

    if (pathChanged && document.githubPath) {
      try {
        const { data: oldFile } = await octokit.repos.getContent({
          owner,
          repo,
          path: document.githubPath,
          ref: branch,
        });
        if (!Array.isArray(oldFile) && oldFile.type === "file") {
          await octokit.repos.deleteFile({
            owner,
            repo,
            path: document.githubPath,
            message: `Remove old ${document.githubPath} (format changed)`,
            sha: oldFile.sha,
            branch,
          });
        }
      } catch {
        // Best-effort cleanup — old file may already be gone
      }
    }

    const commitSha = response.data.commit?.sha;
    const commitUrl = response.data.commit?.html_url ?? undefined;

    let publishStatus = "published";
    if (project.boardColumns) {
      try {
        const columns = JSON.parse(project.boardColumns) as Array<{
          id: string;
          behavior: string;
        }>;
        const publishCol = columns.find((c) => c.behavior === "publish");
        if (publishCol) publishStatus = publishCol.id;
      } catch {
        // Invalid JSON, fall back to "published"
      }
    }

    const publishedAt = Date.now();

    await ctx.runMutation(internal.cms.documents.internalUpdateAfterPublish, {
      documentId: args.documentId,
      githubPath: filePath,
      githubSha: newSha,
      status: publishStatus,
      publishedAt,
    });

    const historyArgs: {
      documentId: typeof args.documentId;
      projectId: typeof document.projectId;
      userId: typeof project.userId;
      commitSha: string;
      commitUrl?: string;
      githubPath: string;
      commitMessage: string;
      contentSnapshot: string;
      frontmatterSnapshot?: string;
      titleSnapshot: string;
      isUpdate: boolean;
    } = {
      documentId: args.documentId,
      projectId: document.projectId,
      userId: project.userId,
      commitSha: commitSha ?? newSha,
      githubPath: filePath,
      commitMessage,
      contentSnapshot: document.content,
      titleSnapshot: document.title,
      isUpdate,
    };
    if (commitUrl) historyArgs.commitUrl = commitUrl;
    if (document.frontmatter)
      historyArgs.frontmatterSnapshot = document.frontmatter;

    await ctx.runMutation(
      internal.cms.documents.internalRecordPublishHistory,
      historyArgs,
    );

    // Deployment verification — confirm the host actually builds this
    // commit; emails the user if it doesn't (convex/deployments/verify.ts).
    // Opt-in per project: skipped entirely unless enabled in settings.
    if (project.deployVerificationEnabled) {
      await ctx.scheduler.runAfter(0, internal.deployments.verify.start, {
        projectId: document.projectId,
        documentId: args.documentId,
        userId: project.userId,
        commitSha: commitSha ?? newSha,
        documentTitle: document.title,
        isUpdate,
        ...(commitUrl ? { commitUrl } : {}),
        ...(project.siteUrl
          ? {
              publishedUrl: buildPublishedUrl({
                siteUrl: project.siteUrl,
                slug: document.slug,
                postUrlPrefix: project.postUrlPrefix,
                framework: project.framework,
              }),
            }
          : {}),
      });
    }

    if (project.siteUrl && project.socialPostOnPublish) {
      const announceArgs: {
        projectId: Id<"projects">;
        documentId: Id<"documents">;
        documentTitle: string;
        publishedUrl: string;
        customText?: string;
      } = {
        projectId: project._id,
        documentId: document._id,
        documentTitle: document.title,
        publishedUrl: buildPublishedUrl({
          siteUrl: project.siteUrl,
          slug: document.slug,
          postUrlPrefix: project.postUrlPrefix,
          framework: project.framework,
        }),
      };
      if (args.socialPostText) announceArgs.customText = args.socialPostText;
      await ctx.scheduler.runAfter(
        0,
        internal.social.post.announcePublish,
        announceArgs,
      );
    }
    return null;
  },
});

/**
 * Public action callable from the client. Authenticates the user,
 * verifies document ownership, then delegates to the internal publish action.
 */
export const publish = action({
  args: {
    documentId: v.id("documents"),
    commitMessage: v.optional(v.string()),
    socialPostText: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args): Promise<null> => {
    const key = await getRateLimitKey(ctx);
    await rateLimiter.limit(ctx, "github:publish", { key, throws: true });

    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const document = await ctx.runQuery(internal.cms.documents.internalGet, {
      documentId: args.documentId,
    });
    if (!document) {
      throw new Error("Document not found");
    }

    const project = await ctx.runQuery(internal.cms.projects.internalGet, {
      projectId: document.projectId,
    });
    if (!project) {
      throw new Error("Project not found");
    }

    const user = await ctx.runQuery(internal.account.users.internalGet, {
      userId: project.userId,
    });
    if (!user) {
      throw new Error("User not found");
    }

    if (user.tokenIdentifier !== identity.tokenIdentifier) {
      throw new Error("Unauthorized: you do not own this document");
    }

    if (args.socialPostText && args.socialPostText.length > 2000) {
      throw new Error("Social post text is too long (max 2000 characters).");
    }

    await ctx.runAction(internal.integrations.github.publishToGithub, {
      documentId: args.documentId,
      ...(args.commitMessage !== undefined && {
        commitMessage: args.commitMessage,
      }),
      ...(args.socialPostText !== undefined && {
        socialPostText: args.socialPostText,
      }),
    });
    return null;
  },
});

/**
 * Bulk publish multiple documents to GitHub in a single atomic commit.
 * Uses the Git Tree API (createBlob → createTree → createCommit → updateRef)
 * so all files appear in one commit rather than N separate commits.
 *
 * Image binaries are no longer migrated here — they live in the user's
 * configured provider (UploadThing / Cloudinary / GitHub) at upload time.
 */
export const bulkPublish = action({
  args: {
    projectId: v.id("projects"),
    documentIds: v.array(v.id("documents")),
  },
  returns: v.object({
    success: v.number(),
    failed: v.number(),
    commitUrl: v.optional(v.string()),
  }),
  handler: async (
    ctx,
    args,
  ): Promise<{ success: number; failed: number; commitUrl?: string }> => {
    const key = await getRateLimitKey(ctx);
    await rateLimiter.limit(ctx, "github:bulkPublish", { key, throws: true });

    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const project = await ctx.runQuery(internal.cms.projects.internalGet, {
      projectId: args.projectId,
    });
    if (!project) throw new Error("Project not found");

    const user = await ctx.runQuery(internal.account.users.internalGet, {
      userId: project.userId,
    });
    if (!user) throw new Error("User not found");
    if (user.tokenIdentifier !== identity.tokenIdentifier) {
      throw new Error("Unauthorized");
    }

    const token = await resolveToken(ctx, user._id);
    if (!project.githubRepo) {
      throw new Error("GitHub repository not configured for this project");
    }

    const { owner, repo } = parseRepoString(project.githubRepo);
    const branch = project.githubBranch ?? "main";
    const contentPath = normalizeRepoPath(project.contentPath ?? "content");

    const octokit = new Octokit({ auth: token });

    const docs: Array<{
      id: (typeof args.documentIds)[number];
      title: string;
      slug: string;
      content: string;
      frontmatter?: string;
      githubSha?: string;
      githubPath?: string;
    }> = [];

    for (const docId of args.documentIds) {
      const doc = await ctx.runQuery(internal.cms.documents.internalGet, {
        documentId: docId,
      });
      if (doc && doc.projectId === args.projectId) {
        const docEntry: {
          id: typeof docId;
          title: string;
          slug: string;
          content: string;
          frontmatter?: string;
          githubSha?: string;
          githubPath?: string;
        } = {
          id: docId,
          title: doc.title,
          slug: doc.slug,
          content: doc.content,
        };
        if (doc.frontmatter) docEntry.frontmatter = doc.frontmatter;
        if (doc.githubSha) docEntry.githubSha = doc.githubSha;
        if (doc.githubPath) docEntry.githubPath = doc.githubPath;
        docs.push(docEntry);
      }
    }

    if (docs.length === 0) {
      return { success: 0, failed: args.documentIds.length };
    }

    const { data: refData } = await octokit.git.getRef({
      owner,
      repo,
      ref: `heads/${branch}`,
    });
    const baseCommitSha = refData.object.sha;

    const { data: commitData } = await octokit.git.getCommit({
      owner,
      repo,
      commit_sha: baseCommitSha,
    });
    const baseTreeSha = commitData.tree.sha;

    const treeEntries: Array<{
      path: string;
      mode: "100644";
      type: "blob";
      sha: string | null;
    }> = [];

    const docFileMap: Array<{
      doc: (typeof docs)[number];
      filePath: string;
      isUpdate: boolean;
    }> = [];

    let failed = 0;

    const ext = getFileExtension(project.contentFormat);

    for (const doc of docs) {
      try {
        const filePath = contentPath
          ? `${contentPath}/${doc.slug}${ext}`
          : `${doc.slug}${ext}`;
        const isUpdate = Boolean(doc.githubSha);

        let frontmatterData: Record<string, unknown> = {
          title: doc.title,
          date: new Date().toISOString(),
          draft: false,
        };
        let parsedDocFrontmatter: Record<string, unknown> = {};
        if (doc.frontmatter) {
          try {
            parsedDocFrontmatter = JSON.parse(doc.frontmatter) ?? {};
            frontmatterData = {
              ...frontmatterData,
              ...parsedDocFrontmatter,
            };
          } catch {
            // Use defaults
          }
        }

        // Same pubDate/draft side-effect as the single-doc publish path:
        // stamp the date only on a first publish, preserve it on re-publish.
        const bulkPublishMoment = new Date();
        const bulkPubDateField = findPubDateField(project.frontmatterSchema);
        if (
          bulkPubDateField &&
          shouldStampPubDate(parsedDocFrontmatter, bulkPubDateField.name)
        ) {
          frontmatterData[bulkPubDateField.name] =
            bulkPubDateField.type === "date"
              ? bulkPublishMoment.toISOString().slice(0, 10)
              : bulkPublishMoment.toISOString();
        }
        frontmatterData["draft"] = false;

        // Same array guard as the single-doc publish path.
        frontmatterData = coerceFrontmatterArrays(
          frontmatterData,
          project.frontmatterSchema,
        );

        const fileContent = buildContentFile(
          frontmatterData,
          doc.content,
          project.frontmatterFormat,
        );

        const { data: blobData } = await octokit.git.createBlob({
          owner,
          repo,
          content: Buffer.from(fileContent).toString("base64"),
          encoding: "base64",
        });

        treeEntries.push({
          path: filePath,
          mode: "100644",
          type: "blob",
          sha: blobData.sha,
        });

        if (doc.githubPath && doc.githubPath !== filePath) {
          treeEntries.push({
            path: doc.githubPath,
            mode: "100644",
            type: "blob",
            sha: null,
          });
        }

        docFileMap.push({ doc, filePath, isUpdate });
      } catch {
        failed++;
      }
    }

    if (treeEntries.length === 0) {
      return { success: 0, failed: args.documentIds.length };
    }

    const { data: newTree } = await octokit.git.createTree({
      owner,
      repo,
      base_tree: baseTreeSha,
      tree: treeEntries,
    });

    const titles = docFileMap.map((d) => d.doc.title);
    const commitMessage =
      titles.length === 1
        ? `Publish ${titles[0]}`
        : `Publish ${String(titles.length)} articles: ${titles.slice(0, 3).join(", ")}${titles.length > 3 ? "..." : ""}`;

    const { data: newCommit } = await octokit.git.createCommit({
      owner,
      repo,
      message: commitMessage,
      tree: newTree.sha,
      parents: [baseCommitSha],
    });

    await octokit.git.updateRef({
      owner,
      repo,
      ref: `heads/${branch}`,
      sha: newCommit.sha,
    });

    const commitUrl = `https://github.com/${owner}/${repo}/commit/${newCommit.sha}`;

    let publishStatus = "published";
    if (project.boardColumns) {
      try {
        const columns = JSON.parse(project.boardColumns) as Array<{
          id: string;
          behavior: string;
        }>;
        const publishCol = columns.find((c) => c.behavior === "publish");
        if (publishCol) publishStatus = publishCol.id;
      } catch {
        // Fall back to "published"
      }
    }

    const publishedAt = Date.now();
    const bulkBatchId = `bulk-${publishedAt}-${Math.random().toString(36).slice(2, 8)}`;

    for (const entry of docFileMap) {
      const blobEntry = treeEntries.find(
        (t) => t.path === entry.filePath && t.sha != null,
      );
      const newFileSha = blobEntry?.sha ?? undefined;

      const updateArgs: {
        documentId: typeof entry.doc.id;
        githubPath: string;
        githubSha?: string;
        status: string;
        publishedAt: number;
      } = {
        documentId: entry.doc.id,
        githubPath: entry.filePath,
        status: publishStatus,
        publishedAt,
      };
      if (newFileSha !== undefined) {
        updateArgs.githubSha = newFileSha;
      }
      await ctx.runMutation(
        internal.cms.documents.internalUpdateAfterPublish,
        updateArgs,
      );

      const bulkHistoryArgs: {
        documentId: typeof entry.doc.id;
        projectId: typeof args.projectId;
        userId: typeof project.userId;
        commitSha: string;
        commitUrl?: string;
        githubPath: string;
        commitMessage: string;
        contentSnapshot: string;
        frontmatterSnapshot?: string;
        titleSnapshot: string;
        isUpdate: boolean;
        isBulk?: boolean;
        bulkBatchId?: string;
      } = {
        documentId: entry.doc.id,
        projectId: args.projectId,
        userId: project.userId,
        commitSha: newCommit.sha,
        commitUrl,
        githubPath: entry.filePath,
        commitMessage,
        contentSnapshot: entry.doc.content,
        titleSnapshot: entry.doc.title,
        isUpdate: entry.isUpdate,
        isBulk: true,
        bulkBatchId,
      };
      if (entry.doc.frontmatter) {
        bulkHistoryArgs.frontmatterSnapshot = entry.doc.frontmatter;
      }

      await ctx.runMutation(
        internal.cms.documents.internalRecordPublishHistory,
        bulkHistoryArgs,
      );

      if (project.siteUrl && project.socialPostOnPublish) {
        await ctx.scheduler.runAfter(0, internal.social.post.announcePublish, {
          projectId: project._id,
          documentId: entry.doc.id,
          documentTitle: entry.doc.title,
          publishedUrl: buildPublishedUrl({
            siteUrl: project.siteUrl,
            slug: entry.doc.slug,
            postUrlPrefix: project.postUrlPrefix,
            framework: project.framework,
          }),
        });
      }
    }

    return {
      success: docFileMap.length,
      failed,
      commitUrl,
    };
  },
});

/**
 * Uploads a media file (image, etc.) to the project's GitHub repo.
 *
 * @deprecated Use `convex/media.ts:upload` with `mediaStorageMode === "github"`.
 * Kept temporarily for the legacy media library "Upload" tab that may still
 * exist in older client builds.
 */
export const uploadMediaToGithub = action({
  args: {
    projectId: v.id("projects"),
    fileName: v.string(),
    base64Content: v.string(),
    contentType: v.string(),
  },
  returns: v.string(),
  handler: async (ctx, args): Promise<string> => {
    const key = await getRateLimitKey(ctx);
    await rateLimiter.limit(ctx, "github:uploadMedia", { key, throws: true });

    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const project = await ctx.runQuery(internal.cms.projects.internalGet, {
      projectId: args.projectId,
    });
    if (!project) {
      throw new Error("Project not found");
    }

    const user = await ctx.runQuery(internal.account.users.internalGet, {
      userId: project.userId,
    });
    if (!user) {
      throw new Error("User not found");
    }

    const token = await resolveToken(ctx, user._id);

    if (!project.githubRepo) {
      throw new Error("GitHub repository not configured");
    }

    const { owner, repo } = parseRepoString(project.githubRepo);
    const branch = project.githubBranch ?? "main";
    const mediaPath = normalizeRepoPath(project.mediaPath ?? "public/images");
    const filePath = joinRepoPath(mediaPath, args.fileName);

    const octokit = new Octokit({ auth: token });

    let existingSha: string | undefined;
    try {
      const { data } = await octokit.repos.getContent({
        owner,
        repo,
        path: filePath,
        ref: branch,
      });
      if (!Array.isArray(data) && data.type === "file") {
        existingSha = data.sha;
      }
    } catch (error: unknown) {
      const err = error as { status?: number; message?: string };
      if (err.status !== 404) {
        throw new Error(
          `Failed to check existing file: ${err.message ?? "Unknown error"}`,
        );
      }
    }

    await octokit.repos.createOrUpdateFileContents({
      owner,
      repo,
      path: filePath,
      message: `Upload media: ${args.fileName}`,
      content: args.base64Content,
      branch,
      ...(existingSha ? { sha: existingSha } : {}),
    });

    // Strip "public/" prefix for the URL since static sites serve from root.
    const urlBase = mediaPath.startsWith("public/")
      ? mediaPath.slice("public/".length)
      : mediaPath;
    return `/${urlBase}/${args.fileName}`;
  },
});

/**
 * Resolves the project + user + GitHub token + Octokit client needed to
 * import files from a repo. Shared by the single-file and batch import
 * actions so they spend the same auth/setup cost exactly once.
 */
async function resolveGithubImportContext(
  ctx: ActionCtx,
  args: { projectId: Id<"projects"> },
): Promise<{
  octokit: Octokit;
  owner: string;
  repo: string;
  branch: string;
}> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new Error("Not authenticated");
  }

  const project = await ctx.runQuery(internal.cms.projects.internalGet, {
    projectId: args.projectId,
  });
  if (!project) {
    throw new Error("Project not found");
  }

  const user = await ctx.runQuery(internal.account.users.internalGet, {
    userId: project.userId,
  });
  if (!user) {
    throw new Error("User not found");
  }

  if (user.tokenIdentifier !== identity.tokenIdentifier) {
    throw new Error("Unauthorized: you do not own this project");
  }

  if (!project.githubRepo) {
    throw new Error("GitHub repository not configured for this project");
  }

  const token = await resolveToken(ctx, user._id);
  const { owner, repo } = parseRepoString(project.githubRepo);
  const branch: string = project.githubBranch ?? "main";
  const octokit = new Octokit({ auth: token });

  return { octokit, owner, repo, branch };
}

/**
 * Parses a markdown blob into { title, slug, content, frontmatter }.
 * Extracted so the bulk-import classifier (which fetches GitHub
 * content for conflicts) can produce the same shape that the workpool
 * job uses.
 */
function parseMarkdownFile(
  fileContent: string,
  filename: string,
): { title: string; slug: string; content: string; frontmatter?: string } {
  let title: string = filename.replace(/\.mdx?$/, "");
  let content: string = fileContent;
  let frontmatter: string | undefined;

  const frontmatterMatch = fileContent.match(
    /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/,
  );
  if (frontmatterMatch) {
    const rawFrontmatter = frontmatterMatch[1] ?? "";
    content = (frontmatterMatch[2] ?? "").trim();

    const fmObj: Record<string, unknown> = {};
    const lines = rawFrontmatter.split("\n");
    let i = 0;
    while (i < lines.length) {
      const line = lines[i] ?? "";
      const colonIdx = line.indexOf(":");
      if (colonIdx <= 0 || line.startsWith("  ") || line.startsWith("\t")) {
        i++;
        continue;
      }
      const key = line.slice(0, colonIdx).trim();
      const rawValue = line.slice(colonIdx + 1).trim();

      const nextLine = lines[i + 1] ?? "";
      if (rawValue === "" && i + 1 < lines.length && /^\s+-\s/.test(nextLine)) {
        const arr: string[] = [];
        i++;
        let arrLine = lines[i] ?? "";
        while (i < lines.length && /^\s+-\s/.test(arrLine)) {
          arr.push(arrLine.replace(/^\s+-\s*/, "").replace(/^["']|["']$/g, ""));
          i++;
          arrLine = lines[i] ?? "";
        }
        fmObj[key] = arr;
        continue;
      }

      let value: unknown = rawValue.replace(/^["']|["']$/g, "");
      if (value === "true") value = true;
      else if (value === "false") value = false;
      else if (
        rawValue !== "" &&
        !Number.isNaN(Number(rawValue)) &&
        !/^["']/.test(rawValue)
      ) {
        value = Number(rawValue);
      }
      fmObj[key] = value;
      i++;
    }

    if (typeof fmObj["title"] === "string" && fmObj["title"]) {
      title = fmObj["title"];
    }

    frontmatter = JSON.stringify(fmObj);
  }

  const slug = filename.replace(/\.mdx?$/, "");
  const result: {
    title: string;
    slug: string;
    content: string;
    frontmatter?: string;
  } = { title, slug, content };
  if (frontmatter !== undefined) result.frontmatter = frontmatter;
  return result;
}

/**
 * Fetches a single markdown file from GitHub, parses frontmatter, and
 * inserts it as a document. Throws on parse / fetch failures so the
 * caller can decide whether to abort or aggregate.
 *
 * `mode` is optional for backwards compatibility: when present the
 * caller is a smart-sync job (knows whether it's a `new` insert or a
 * `fastForward` overwrite) and we go through `_upsertImportedDocument`.
 * When absent we keep the legacy single-file path that dedups on
 * `githubPath` via `_importFromGithubInternal`.
 */
async function importOneFile(
  ctx: ActionCtx,
  args: {
    octokit: Octokit;
    owner: string;
    repo: string;
    branch: string;
    projectId: Id<"projects">;
    filePath: string;
    mode?: "new" | "fastForward";
  },
): Promise<{ documentId: string; title: string; slug: string }> {
  const { data } = await args.octokit.repos.getContent({
    owner: args.owner,
    repo: args.repo,
    path: args.filePath,
    ref: args.branch,
  });

  if (Array.isArray(data) || data.type !== "file") {
    throw new Error(`Path "${args.filePath}" is not a file`);
  }

  const fileContent = Buffer.from(data.content, "base64").toString("utf-8");
  const githubSha = data.sha;
  const parsed = parseMarkdownFile(fileContent, data.name);

  if (args.mode) {
    const upsertArgs: {
      projectId: Id<"projects">;
      title: string;
      slug: string;
      content: string;
      githubPath: string;
      githubSha: string;
      githubSyncedAt: number;
      mode: "new" | "fastForward";
      frontmatter?: string;
    } = {
      projectId: args.projectId,
      title: parsed.title,
      slug: parsed.slug,
      content: parsed.content,
      githubPath: args.filePath,
      githubSha,
      githubSyncedAt: Date.now(),
      mode: args.mode,
    };
    if (parsed.frontmatter !== undefined)
      upsertArgs.frontmatter = parsed.frontmatter;
    const documentId = await ctx.runMutation(
      internal.cms.documents._upsertImportedDocument,
      upsertArgs,
    );
    return { documentId, title: parsed.title, slug: parsed.slug };
  }

  const mutationArgs: {
    projectId: Id<"projects">;
    title: string;
    slug: string;
    content: string;
    githubPath: string;
    githubSha: string;
    frontmatter?: string;
  } = {
    projectId: args.projectId,
    title: parsed.title,
    slug: parsed.slug,
    content: parsed.content,
    githubPath: args.filePath,
    githubSha,
  };
  if (parsed.frontmatter !== undefined)
    mutationArgs.frontmatter = parsed.frontmatter;

  const documentId = await ctx.runMutation(
    internal.cms.documents._importFromGithubInternal,
    mutationArgs,
  );

  return { documentId, title: parsed.title, slug: parsed.slug };
}

/**
 * Imports a single markdown file from a GitHub repo into the project.
 */
export const importFileFromGithub = action({
  args: {
    projectId: v.id("projects"),
    filePath: v.string(),
  },
  returns: IMPORTED_FILE_RESULT,
  handler: async (
    ctx,
    args,
  ): Promise<{ documentId: string; title: string; slug: string }> => {
    const key = await getRateLimitKey(ctx);
    await rateLimiter.limit(ctx, "github:importFile", { key, throws: true });

    const setup = await resolveGithubImportContext(ctx, {
      projectId: args.projectId,
    });

    return importOneFile(ctx, {
      ...setup,
      projectId: args.projectId,
      filePath: args.filePath,
    });
  },
});

/**
 * Workpool job — imports a single file and is dispatched once per file by
 * {@link startBulkImport}. Internal-only: the public entry point creates
 * the `import_batches` row and enqueues these in `convex/importPool.ts`.
 *
 * The job intentionally does NOT touch the batch row directly — that's
 * the responsibility of the workpool's `onComplete` callback so success
 * and failure counters update atomically based on whether this returns
 * or throws. Throwing here just records the failure in the batch's
 * errors array; the rest of the batch keeps progressing.
 *
 * Token note: the OAuth/PAT is resolved once at batch start and threaded
 * through each job. That trades a tiny bit of workpool-state visibility
 * for a meaningful reduction in Clerk-SDK round-trips (200 files would
 * otherwise be 200 Clerk calls).
 *
 * `mode` is set by `startBulkImport` after diff-classification — `new`
 * for files not yet in Convex, `fastForward` for files where only
 * GitHub changed. The job passes it through to
 * `_upsertImportedDocument` so the write is explicit rather than
 * inferred from a path lookup that could race with another sync.
 */
export const _importOneFromGithubJob = internalAction({
  args: {
    batchId: v.id("import_batches"),
    projectId: v.id("projects"),
    filePath: v.string(),
    token: v.string(),
    owner: v.string(),
    repo: v.string(),
    branch: v.string(),
    mode: v.union(v.literal("new"), v.literal("fastForward")),
  },
  returns: IMPORTED_FILE_RESULT,
  handler: async (
    ctx,
    args,
  ): Promise<{ documentId: string; title: string; slug: string }> => {
    const octokit = new Octokit({ auth: args.token });
    return importOneFile(ctx, {
      octokit,
      owner: args.owner,
      repo: args.repo,
      branch: args.branch,
      projectId: args.projectId,
      filePath: args.filePath,
      mode: args.mode,
    });
  },
});

/**
 * Result of `startBulkImport`. `batchId` is `null` when no workpool
 * jobs were enqueued — i.e. every requested path was unchanged, a
 * conflict, or missing on GitHub. The UI uses `results` to render a
 * completion summary in either case.
 *
 * Counts and per-path bucket lists are deliberately split: counts are
 * small and always rendered (banner / dialog), bucket lists feed
 * detail views (conflicts route, "view skipped" expander) and may be
 * long.
 */
export type BulkImportResult = {
  batchId: Id<"import_batches"> | null;
  counts: {
    new: number;
    fastForward: number;
    unchanged: number;
    conflict: number;
    missing: number;
  };
  conflicts: Array<{
    path: string;
    documentId: Id<"documents">;
    conflictId: Id<"sync_conflicts">;
  }>;
  missing: string[];
};

/** Runtime validator mirroring {@link BulkImportResult}. */
const BULK_IMPORT_RESULT = v.object({
  batchId: v.union(v.id("import_batches"), v.null()),
  counts: v.object({
    new: v.number(),
    fastForward: v.number(),
    unchanged: v.number(),
    conflict: v.number(),
    missing: v.number(),
  }),
  conflicts: v.array(
    v.object({
      path: v.string(),
      documentId: v.id("documents"),
      conflictId: v.id("sync_conflicts"),
    }),
  ),
  missing: v.array(v.string()),
});

/**
 * Public entry point for bulk import. Compares the requested files
 * against what's already in Convex *before* spinning up the workpool,
 * so a re-sync of an unchanged repo costs ~2 function calls instead
 * of ~5N. Outcomes per file:
 *
 *  - `new`          → not in Convex, enqueue (workpool insert)
 *  - `fastForward`  → SHA changed on GitHub, no local edits since
 *                     last sync, enqueue (workpool overwrite)
 *  - `unchanged`    → SHA matches Convex, skip (zero cost)
 *  - `conflict`     → both sides changed since last sync; we fetch the
 *                     GitHub content and write a `sync_conflicts` row
 *                     for the user to resolve. The doc itself is NOT
 *                     touched here.
 *  - `missing`      → file exists in Convex but is no longer in the
 *                     GitHub tree at this path. Reported back so the
 *                     UI can prompt the user to soft-delete.
 *
 * Returns `{ batchId: null, counts, conflicts, missing }` when there's
 * nothing to import; otherwise `batchId` points at the live progress
 * row.
 *
 * Runs as an action (not a mutation) because it needs to resolve the
 * GitHub token and fetch the tree before enqueuing — both Node-only.
 */
export const startBulkImport = action({
  args: {
    projectId: v.id("projects"),
    filePaths: v.array(v.string()),
  },
  returns: BULK_IMPORT_RESULT,
  handler: async (ctx, args): Promise<BulkImportResult> => {
    if (args.filePaths.length === 0) {
      throw new Error("No files to import");
    }
    const filePaths = Array.from(new Set(args.filePaths));
    if (filePaths.length > 200) {
      throw new Error("Cannot import more than 200 files in a single batch");
    }

    const key = await getRateLimitKey(ctx);
    await rateLimiter.limit(ctx, "documents:startBulkImport", {
      key,
      throws: true,
    });

    const setup = await resolveGithubImportContext(ctx, {
      projectId: args.projectId,
    });
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const user = await ctx.runQuery(internal.account.users.internalGetByToken, {
      tokenIdentifier: identity.tokenIdentifier,
    });
    if (!user) throw new Error("User not found");
    const token = await resolveToken(ctx, user._id);
    const octokitWithToken = new Octokit({ auth: token });

    // 1. Fetch the GitHub tree once and build a path→sha map for the
    //    requested files. Two API calls: get the branch's tip commit
    //    (so we know the root tree SHA) then walk the tree recursively.
    //    This replaces N per-file Contents calls during the
    //    classification step — only conflict-content fetches remain
    //    inline (one per conflict, run in parallel below).
    const refData = await setup.octokit.git.getRef({
      owner: setup.owner,
      repo: setup.repo,
      ref: `heads/${setup.branch}`,
    });
    const commitData = await setup.octokit.git.getCommit({
      owner: setup.owner,
      repo: setup.repo,
      commit_sha: refData.data.object.sha,
    });
    const treeData = await setup.octokit.git.getTree({
      owner: setup.owner,
      repo: setup.repo,
      tree_sha: commitData.data.tree.sha,
      recursive: "true",
    });

    const remoteShaByPath = new Map<string, string>();
    const requestedSet = new Set(filePaths);
    for (const entry of treeData.data.tree) {
      if (entry.type === "blob" && entry.path && entry.sha) {
        if (requestedSet.has(entry.path)) {
          remoteShaByPath.set(entry.path, entry.sha);
        }
      }
    }

    // 2. Fetch local state for the same paths.
    const localByPath = new Map<
      string,
      {
        documentId: Id<"documents">;
        githubSha: string | undefined;
        updatedAt: number;
        githubSyncedAt: number | undefined;
        content: string;
        frontmatter: string | undefined;
      }
    >();
    const localRows = await ctx.runQuery(
      internal.cms.documents._getExistingGithubFilesByPaths,
      { projectId: args.projectId, paths: filePaths },
    );
    for (const r of localRows) {
      localByPath.set(r.githubPath, {
        documentId: r.documentId,
        githubSha: r.githubSha,
        updatedAt: r.updatedAt,
        githubSyncedAt: r.githubSyncedAt,
        content: r.content,
        frontmatter: r.frontmatter,
      });
    }

    // 3. Classify each path. Hold conflicts in a separate list so we
    //    can fetch their content in parallel after the classification
    //    pass — keeps the classifier itself synchronous and cheap.
    const toEnqueue: Array<{
      path: string;
      mode: "new" | "fastForward";
    }> = [];
    const unchanged: string[] = [];
    const conflictCandidates: Array<{
      path: string;
      documentId: Id<"documents">;
      remoteSha: string;
      localContentSnapshot: string;
      localFrontmatterSnapshot: string | undefined;
    }> = [];
    const missing: string[] = [];

    for (const path of filePaths) {
      const remoteSha = remoteShaByPath.get(path);
      const local = localByPath.get(path);

      if (!remoteSha && !local) {
        // Requested path doesn't exist on GitHub *and* not in Convex.
        // Could be a typo from the caller; surface as missing.
        missing.push(path);
        continue;
      }
      if (!remoteSha && local) {
        missing.push(path);
        continue;
      }
      if (!local) {
        toEnqueue.push({ path, mode: "new" });
        continue;
      }
      if (local.githubSha === remoteSha) {
        unchanged.push(path);
        continue;
      }
      // Remote SHA differs from local. If the local doc hasn't been
      // edited since its last sync, this is a clean fast-forward.
      // Otherwise both sides have diverged → conflict.
      const lastSync = local.githubSyncedAt ?? local.updatedAt;
      if (local.updatedAt <= lastSync) {
        toEnqueue.push({ path, mode: "fastForward" });
      } else {
        conflictCandidates.push({
          path,
          documentId: local.documentId,
          // biome-ignore lint/style/noNonNullAssertion: presence checked above
          remoteSha: remoteSha!,
          localContentSnapshot: local.content,
          localFrontmatterSnapshot: local.frontmatter,
        });
      }
    }

    // 4. For each conflict, fetch the GitHub content so the conflict
    //    row carries a stable snapshot for the diff UI. Parallel
    //    fetches with `Promise.all` are fine — GitHub allows 5000
    //    Contents API calls per hour, and the per-batch cap is 200.
    //    If any fetch fails we skip writing that conflict (the next
    //    sync will retry); rest of the batch proceeds.
    const conflicts: Array<{
      path: string;
      documentId: Id<"documents">;
      conflictId: Id<"sync_conflicts">;
    }> = [];
    if (conflictCandidates.length > 0) {
      const fetched = await Promise.all(
        conflictCandidates.map(async (c) => {
          try {
            const { data } = await octokitWithToken.repos.getContent({
              owner: setup.owner,
              repo: setup.repo,
              path: c.path,
              ref: setup.branch,
            });
            if (Array.isArray(data) || data.type !== "file") return null;
            const remoteText = Buffer.from(data.content, "base64").toString(
              "utf-8",
            );
            const parsed = parseMarkdownFile(remoteText, data.name);
            return { candidate: c, parsed };
          } catch (err) {
            console.warn(
              `[startBulkImport] failed to fetch conflict snapshot for ${c.path}`,
              err,
            );
            return null;
          }
        }),
      );
      for (const item of fetched) {
        if (!item) continue;
        const { candidate, parsed } = item;
        const createArgs: {
          projectId: Id<"projects">;
          documentId: Id<"documents">;
          userId: Id<"users">;
          githubPath: string;
          remoteSha: string;
          remoteContent: string;
          remoteFrontmatter?: string;
          localContentSnapshot: string;
          localFrontmatterSnapshot?: string;
        } = {
          projectId: args.projectId,
          documentId: candidate.documentId,
          userId: user._id,
          githubPath: candidate.path,
          remoteSha: candidate.remoteSha,
          remoteContent: parsed.content,
          localContentSnapshot: candidate.localContentSnapshot,
        };
        if (parsed.frontmatter !== undefined) {
          createArgs.remoteFrontmatter = parsed.frontmatter;
        }
        if (candidate.localFrontmatterSnapshot !== undefined) {
          createArgs.localFrontmatterSnapshot =
            candidate.localFrontmatterSnapshot;
        }
        const conflictId = await ctx.runMutation(
          internal.cms.conflicts._create,
          createArgs,
        );
        conflicts.push({
          path: candidate.path,
          documentId: candidate.documentId,
          conflictId,
        });
      }
    }

    const counts = {
      new: toEnqueue.filter((j) => j.mode === "new").length,
      fastForward: toEnqueue.filter((j) => j.mode === "fastForward").length,
      unchanged: unchanged.length,
      conflict: conflicts.length,
      missing: missing.length,
    };

    // 5. If nothing needs the workpool, skip the batch row entirely.
    //    The UI uses the counts + conflicts to render its summary; no
    //    progress bar to subscribe to.
    if (toEnqueue.length === 0) {
      return {
        batchId: null,
        counts,
        conflicts,
        missing,
      };
    }

    // 6. Otherwise create the tracking row and enqueue only the paths
    //    that actually need a write.
    const batchId: Id<"import_batches"> = await ctx.runMutation(
      internal.cms.documents._createImportBatch,
      {
        projectId: args.projectId,
        userId: user._id,
        total: toEnqueue.length,
      },
    );

    for (const job of toEnqueue) {
      await importPool.enqueueAction(
        ctx,
        internal.integrations.github._importOneFromGithubJob,
        {
          batchId,
          projectId: args.projectId,
          filePath: job.path,
          token,
          owner: setup.owner,
          repo: setup.repo,
          branch: setup.branch,
          mode: job.mode,
        },
        {
          onComplete: internal.cms.documents._onImportFileComplete,
          context: { batchId, filePath: job.path },
        },
      );
    }

    return { batchId, counts, conflicts, missing };
  },
});

/**
 * Validates that the caller has access to the specified GitHub repository.
 *
 * The action requires authentication and resolves the token server-side
 * via the same three-tier flow as every other GitHub action: Clerk OAuth
 * first, then vault PAT, then legacy plaintext. Callers may also pass a
 * `pat` argument to test a PAT they haven't saved yet (the connect
 * wizard's "verify before save" flow).
 */
export const verifyRepoAccess = action({
  args: {
    repo: v.string(),
    pat: v.optional(v.string()),
  },
  returns: v.object({
    valid: v.boolean(),
    error: v.optional(v.string()),
  }),
  handler: async (ctx, args): Promise<{ valid: boolean; error?: string }> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return { valid: false, error: "Not authenticated" };
    }

    const user = await ctx.runQuery(internal.account.users.internalGetByToken, {
      tokenIdentifier: identity.tokenIdentifier,
    });
    if (!user) {
      return { valid: false, error: "User not found" };
    }

    const key = await getRateLimitKey(ctx);
    await rateLimiter.limit(ctx, "github:verifyRepoAccess", {
      key,
      throws: true,
    });

    const token = args.pat?.trim() || (await getGithubToken(ctx, user._id));
    if (!token) {
      return {
        valid: false,
        error: "Connect GitHub via OAuth or provide a Personal Access Token",
      };
    }

    const { owner, repo } = parseRepoString(args.repo);

    try {
      const octokit = new Octokit({ auth: token });
      await octokit.repos.get({ owner, repo });
      return { valid: true };
    } catch (error: unknown) {
      const err = error as { status?: number; message?: string };
      const message =
        err.status === 404
          ? "Repository not found or you don't have access"
          : err.status === 401
            ? "Invalid or expired GitHub token"
            : `GitHub API error: ${err.message ?? "Unknown error"}`;
      return { valid: false, error: message };
    }
  },
});

/**
 * Deletes a file from the project's GitHub repository.
 */
export const deleteFileFromGithub = action({
  args: {
    projectId: v.id("projects"),
    filePath: v.string(),
    sha: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args): Promise<null> => {
    const key = await getRateLimitKey(ctx);
    await rateLimiter.limit(ctx, "github:deleteFile", { key, throws: true });

    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const project = await ctx.runQuery(internal.cms.projects.internalGet, {
      projectId: args.projectId,
    });
    if (!project) {
      throw new Error("Project not found");
    }

    const user = await ctx.runQuery(internal.account.users.internalGet, {
      userId: project.userId,
    });
    if (!user) {
      throw new Error("User not found");
    }

    if (user.tokenIdentifier !== identity.tokenIdentifier) {
      throw new Error("Unauthorized: you do not own this project");
    }

    const token = await resolveToken(ctx, user._id);

    if (!project.githubRepo) {
      throw new Error("GitHub repository not configured for this project");
    }

    const { owner, repo } = parseRepoString(project.githubRepo);
    const branch = project.githubBranch ?? "main";

    const octokit = new Octokit({ auth: token });

    await octokit.repos.deleteFile({
      owner,
      repo,
      path: args.filePath,
      message: `Delete ${args.filePath.split("/").pop()}`,
      sha: args.sha,
      branch,
    });
    return null;
  },
});

/* ------------------------------------------------------------------ */
/*  Bulk delete — workpool job + public entry action                    */
/* ------------------------------------------------------------------ */

/**
 * Workpool job that removes one item per the chosen mode. Symmetric to
 * `_importOneFromGithubJob`. Throws on any failure so the workpool's
 * `onComplete` callback can record it on the parent `delete_batches`
 * row.
 *
 * Token, owner, repo, branch are passed in (resolved once by the parent
 * action) so each job doesn't redundantly hit Clerk/Vault for hundreds
 * of files. Token field is omitted entirely for local-only mode.
 */
export const _deleteOneJob = internalAction({
  args: {
    batchId: v.id("delete_batches"),
    /** Project scope — the internal delete mutation enforces that the
     *  doc actually belongs here, so a malformed payload can't reach
     *  across projects. */
    projectId: v.id("projects"),
    mode: v.union(v.literal("local"), v.literal("github"), v.literal("both")),
    documentId: v.optional(v.id("documents")),
    filePath: v.optional(v.string()),
    githubSha: v.optional(v.string()),
    token: v.optional(v.string()),
    owner: v.optional(v.string()),
    repo: v.optional(v.string()),
    branch: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args): Promise<null> => {
    // Step 1: local doc removal (cascades scheduled_publishes via the
    // internal mutation). Skip when the user asked for GitHub-only.
    if (args.mode !== "github" && args.documentId) {
      await ctx.runMutation(internal.cms.documents._removeInternal, {
        documentId: args.documentId,
        projectId: args.projectId,
      });
    }

    // Step 2: GitHub file removal. Requires all four of (token, owner,
    // repo, branch, filePath, sha) — caller is responsible for filtering
    // jobs that don't have GitHub state when mode includes "github".
    if (args.mode !== "local") {
      if (
        !args.token ||
        !args.owner ||
        !args.repo ||
        !args.branch ||
        !args.filePath ||
        !args.githubSha
      ) {
        // For "both" mode, a doc with no GitHub linkage is still a partial
        // success — local was deleted in step 1. Surface a soft error so
        // the user knows the GitHub copy wasn't touched.
        if (args.mode === "both") {
          throw new Error("Skipped GitHub delete: file was not synced");
        }
        throw new Error("Missing GitHub coordinates for delete");
      }
      const octokit = new Octokit({ auth: args.token });
      try {
        await octokit.repos.deleteFile({
          owner: args.owner,
          repo: args.repo,
          path: args.filePath,
          message: `Delete ${args.filePath.split("/").pop()}`,
          sha: args.githubSha,
          branch: args.branch,
        });
      } catch (err: unknown) {
        const e = err as { status?: number; message?: string };
        if (e.status === 404) {
          // File already gone — idempotent success. Don't throw so the
          // batch counts this as succeeded.
          return null;
        }
        throw err;
      }
    }
    return null;
  },
});

export type BulkDeleteResult = {
  /**
   * Present when the workpool was actually engaged. Null when the
   * operation completed inline (local-only mode) and the UI should
   * render `inlineSummary` directly instead of subscribing to a batch
   * row.
   */
  batchId: Id<"delete_batches"> | null;
  /** Set when the action handled the delete inline. */
  inlineSummary?: {
    total: number;
    succeeded: number;
    failed: number;
    errors: Array<{ label: string; message: string }>;
  };
};

/** Runtime validator mirroring {@link BulkDeleteResult}. */
const BULK_DELETE_RESULT = v.object({
  batchId: v.union(v.id("delete_batches"), v.null()),
  inlineSummary: v.optional(
    v.object({
      total: v.number(),
      succeeded: v.number(),
      failed: v.number(),
      errors: v.array(v.object({ label: v.string(), message: v.string() })),
    }),
  ),
});

/**
 * Public entry point for bulk delete. Routes by mode to keep the
 * workpool out of cheap operations:
 *
 *  - **mode === "local"** — soft-delete the docs inline via a
 *    single internal mutation. Zero workpool jobs. The UI shows the
 *    summary immediately. A 50-doc local delete is 1 function call
 *    here vs ~250 through the old pool.
 *  - **mode includes github** — keep the workpool flow. Each file
 *    needs a GitHub API call + auth context; the workpool's bounded
 *    concurrency + retry policy are the right primitive.
 *
 * Item shape mirrors what the selection toolbar already collects so the
 * caller doesn't have to do schema gymnastics.
 */
export const startBulkDelete = action({
  args: {
    projectId: v.id("projects"),
    mode: v.union(v.literal("local"), v.literal("github"), v.literal("both")),
    items: v.array(
      v.object({
        documentId: v.optional(v.id("documents")),
        filePath: v.optional(v.string()),
        githubSha: v.optional(v.string()),
        /** Human label for the error array — slug, title, or path. */
        label: v.string(),
      }),
    ),
  },
  returns: BULK_DELETE_RESULT,
  handler: async (ctx, args): Promise<BulkDeleteResult> => {
    if (args.items.length === 0) {
      throw new Error("Nothing to delete");
    }
    if (args.items.length > 200) {
      throw new Error("Cannot delete more than 200 items in a single batch");
    }

    const key = await getRateLimitKey(ctx);
    await rateLimiter.limit(ctx, "documents:startBulkDelete", {
      key,
      throws: true,
    });

    // Ownership + repo context. For local-only deletes we still verify
    // the user owns the project; we skip the token + repo lookup since
    // no GitHub call will fire.
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const project = await ctx.runQuery(internal.cms.projects.internalGet, {
      projectId: args.projectId,
    });
    if (!project) throw new Error("Project not found");
    const user = await ctx.runQuery(internal.account.users.internalGet, {
      userId: project.userId,
    });
    if (!user) throw new Error("User not found");
    if (user.tokenIdentifier !== identity.tokenIdentifier) {
      throw new Error("Unauthorized: you do not own this project");
    }

    // SECURITY: pre-flight check that every documentId in the payload
    // actually belongs to `args.projectId`. The workpool job (and the
    // inline mutation) re-check this for defense in depth, but failing
    // fast here keeps a malicious or buggy caller from even creating
    // a batch row + N enqueued jobs that would have no-opped.
    const documentIdsInPayload = args.items
      .map((it) => it.documentId)
      .filter((id): id is Id<"documents"> => id !== undefined);
    if (documentIdsInPayload.length > 0) {
      const docs = await ctx.runQuery(
        internal.cms.documents._listByIdsForProject,
        {
          ids: documentIdsInPayload,
          projectId: args.projectId,
        },
      );
      if (docs.length !== documentIdsInPayload.length) {
        throw new Error(
          "One or more documents in the selection don't belong to this project",
        );
      }
    }

    // ── Inline fast path: local-only delete ────────────────────────
    // No GitHub calls, no workpool needed. Chunk the doc list into
    // groups of 50 so each internal mutation stays comfortably under
    // Convex's per-transaction limits.
    if (args.mode === "local") {
      const docIds = documentIdsInPayload;
      const labelByDocId = new Map<Id<"documents">, string>();
      for (const item of args.items) {
        if (item.documentId) labelByDocId.set(item.documentId, item.label);
      }

      let trashed = 0;
      const CHUNK = 50;
      for (let i = 0; i < docIds.length; i += CHUNK) {
        const slice = docIds.slice(i, i + CHUNK);
        const { trashed: count } = await ctx.runMutation(
          internal.cms.documents._bulkSoftDeleteLocal,
          { projectId: args.projectId, documentIds: slice },
        );
        trashed += count;
      }

      return {
        batchId: null,
        inlineSummary: {
          total: args.items.length,
          succeeded: trashed,
          failed: args.items.length - trashed,
          errors: [],
        },
      };
    }

    // ── Workpool path: github or both modes ───────────────────────
    if (!project.githubRepo) {
      throw new Error("GitHub repository not configured for this project");
    }
    const token = await resolveToken(ctx, user._id);
    const { owner, repo } = parseRepoString(project.githubRepo);
    const branch = project.githubBranch ?? "main";

    const batchId: Id<"delete_batches"> = await ctx.runMutation(
      internal.cms.documents._createDeleteBatch,
      {
        projectId: args.projectId,
        userId: user._id,
        mode: args.mode,
        total: args.items.length,
      },
    );

    for (const item of args.items) {
      const jobArgs: {
        batchId: Id<"delete_batches">;
        projectId: Id<"projects">;
        mode: typeof args.mode;
        documentId?: Id<"documents">;
        filePath?: string;
        githubSha?: string;
        token?: string;
        owner?: string;
        repo?: string;
        branch?: string;
      } = {
        batchId,
        projectId: args.projectId,
        mode: args.mode,
        token,
        owner,
        repo,
        branch,
      };
      if (item.documentId) jobArgs.documentId = item.documentId;
      if (item.filePath) jobArgs.filePath = item.filePath;
      if (item.githubSha) jobArgs.githubSha = item.githubSha;

      await importPool.enqueueAction(
        ctx,
        internal.integrations.github._deleteOneJob,
        jobArgs,
        {
          onComplete: internal.cms.documents._onDeleteFileComplete,
          context: { batchId, label: item.label },
        },
      );
    }

    return { batchId };
  },
});
