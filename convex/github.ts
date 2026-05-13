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
 * Media migration at publish time has been removed — uploads now go directly
 * to the project's configured provider via `convex/media.ts:upload`.
 */
"use node";

import { Octokit } from "@octokit/rest";
import { v } from "convex/values";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import type { ActionCtx } from "./_generated/server";
import { action, internalAction } from "./_generated/server";
import { getGithubToken } from "./auth_helpers";
import { getRateLimitKey, rateLimiter } from "./rateLimits";

/**
 * Assembles a complete markdown file with YAML frontmatter from structured data.
 * Handles quoting for strings that contain YAML-special characters, and supports
 * nested objects and arrays in the frontmatter values.
 */
function buildMarkdownFile(
  frontmatter: Record<string, unknown>,
  content: string,
): string {
  const yamlLines: string[] = [];

  for (const [key, value] of Object.entries(frontmatter)) {
    if (value === null || value === undefined) {
      continue;
    }

    if (typeof value === "string") {
      if (
        value.includes(":") ||
        value.includes("#") ||
        value.includes("'") ||
        value.includes('"') ||
        value.includes("\n") ||
        value.startsWith(" ") ||
        value.endsWith(" ")
      ) {
        yamlLines.push(`${key}: "${value.replace(/"/g, '\\"')}"`);
      } else {
        yamlLines.push(`${key}: ${value}`);
      }
    } else if (typeof value === "boolean" || typeof value === "number") {
      yamlLines.push(`${key}: ${value}`);
    } else if (Array.isArray(value)) {
      yamlLines.push(`${key}:`);
      for (const item of value) {
        yamlLines.push(`  - ${item}`);
      }
    } else if (typeof value === "object") {
      yamlLines.push(`${key}:`);
      for (const [subKey, subValue] of Object.entries(
        value as Record<string, unknown>,
      )) {
        yamlLines.push(`  ${subKey}: ${subValue}`);
      }
    }
  }

  const yamlBlock = yamlLines.join("\n");
  return `---\n${yamlBlock}\n---\n\n${content}\n`;
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
  },
  handler: async (ctx, args) => {
    const document = await ctx.runQuery(internal.documents.internalGet, {
      documentId: args.documentId,
    });
    if (!document) {
      throw new Error("Document not found");
    }

    const project = await ctx.runQuery(internal.projects.internalGet, {
      projectId: document.projectId,
    });
    if (!project) {
      throw new Error("Project not found");
    }

    const user = await ctx.runQuery(internal.users.internalGet, {
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
    const filePath = joinRepoPath(
      project.contentPath ?? "content",
      `${document.slug}.md`,
    );

    const octokit = new Octokit({ auth: token });

    let frontmatterData: Record<string, unknown> = {
      title: document.title,
      date: new Date().toISOString(),
      draft: false,
    };

    if (document.frontmatter) {
      try {
        const parsed = JSON.parse(document.frontmatter);
        frontmatterData = { ...frontmatterData, ...parsed };
      } catch {
        // If frontmatter JSON is invalid, use defaults only
      }
    }

    const fileContent = buildMarkdownFile(frontmatterData, document.content);
    const base64Content = Buffer.from(fileContent).toString("base64");

    let existingSha: string | undefined = document.githubSha ?? undefined;

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
    const commitMessage = isUpdate
      ? `Update ${document.title}`
      : `Add ${document.title}`;

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
      if (err.status === 401) {
        throw new Error(
          "GitHub token expired or revoked. Please reconnect GitHub in settings.",
        );
      }
      if (err.status === 404) {
        // 404 on a Contents write is almost never "file not found" — GitHub
        // uses it to mask permission, scope, and visibility failures. Probe
        // the auth chain and surface a precise diagnosis.
        const why = await describeWriteFailure(octokit, owner, repo);
        throw new Error(`GitHub publish failed: ${why}`);
      }
      throw error;
    }

    const newSha = response.data.content?.sha;
    if (!newSha) {
      throw new Error("GitHub API did not return a file SHA");
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

    await ctx.runMutation(internal.documents.internalUpdateAfterPublish, {
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
      internal.documents.internalRecordPublishHistory,
      historyArgs,
    );
  },
});

/**
 * Public action callable from the client. Authenticates the user,
 * verifies document ownership, then delegates to the internal publish action.
 */
export const publish = action({
  args: {
    documentId: v.id("documents"),
  },
  handler: async (ctx, args): Promise<void> => {
    const key = await getRateLimitKey(ctx);
    await rateLimiter.limit(ctx, "github:publish", { key, throws: true });

    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const document = await ctx.runQuery(internal.documents.internalGet, {
      documentId: args.documentId,
    });
    if (!document) {
      throw new Error("Document not found");
    }

    const project = await ctx.runQuery(internal.projects.internalGet, {
      projectId: document.projectId,
    });
    if (!project) {
      throw new Error("Project not found");
    }

    const user = await ctx.runQuery(internal.users.internalGet, {
      userId: project.userId,
    });
    if (!user) {
      throw new Error("User not found");
    }

    if (user.tokenIdentifier !== identity.tokenIdentifier) {
      throw new Error("Unauthorized: you do not own this document");
    }

    await ctx.runAction(internal.github.publishToGithub, {
      documentId: args.documentId,
    });
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
  handler: async (
    ctx,
    args,
  ): Promise<{ success: number; failed: number; commitUrl?: string }> => {
    const key = await getRateLimitKey(ctx);
    await rateLimiter.limit(ctx, "github:bulkPublish", { key, throws: true });

    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const project = await ctx.runQuery(internal.projects.internalGet, {
      projectId: args.projectId,
    });
    if (!project) throw new Error("Project not found");

    const user = await ctx.runQuery(internal.users.internalGet, {
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
    }> = [];

    for (const docId of args.documentIds) {
      const doc = await ctx.runQuery(internal.documents.internalGet, {
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
        } = {
          id: docId,
          title: doc.title,
          slug: doc.slug,
          content: doc.content,
        };
        if (doc.frontmatter) docEntry.frontmatter = doc.frontmatter;
        if (doc.githubSha) docEntry.githubSha = doc.githubSha;
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
      sha: string;
    }> = [];

    const docFileMap: Array<{
      doc: (typeof docs)[number];
      filePath: string;
      isUpdate: boolean;
    }> = [];

    let failed = 0;

    for (const doc of docs) {
      try {
        const filePath = contentPath
          ? `${contentPath}/${doc.slug}.md`
          : `${doc.slug}.md`;
        const isUpdate = Boolean(doc.githubSha);

        let frontmatterData: Record<string, unknown> = {
          title: doc.title,
          date: new Date().toISOString(),
          draft: false,
        };
        if (doc.frontmatter) {
          try {
            frontmatterData = {
              ...frontmatterData,
              ...JSON.parse(doc.frontmatter),
            };
          } catch {
            // Use defaults
          }
        }

        const fileContent = buildMarkdownFile(frontmatterData, doc.content);

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
      const blobEntry = treeEntries.find((t) => t.path === entry.filePath);
      const newFileSha = blobEntry?.sha ?? newCommit.sha;

      await ctx.runMutation(internal.documents.internalUpdateAfterPublish, {
        documentId: entry.doc.id,
        githubPath: entry.filePath,
        githubSha: newFileSha,
        status: publishStatus,
        publishedAt,
      });

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
        internal.documents.internalRecordPublishHistory,
        bulkHistoryArgs,
      );
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
  handler: async (ctx, args): Promise<string> => {
    const key = await getRateLimitKey(ctx);
    await rateLimiter.limit(ctx, "github:uploadMedia", { key, throws: true });

    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const project = await ctx.runQuery(internal.projects.internalGet, {
      projectId: args.projectId,
    });
    if (!project) {
      throw new Error("Project not found");
    }

    const user = await ctx.runQuery(internal.users.internalGet, {
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

  const project = await ctx.runQuery(internal.projects.internalGet, {
    projectId: args.projectId,
  });
  if (!project) {
    throw new Error("Project not found");
  }

  const user = await ctx.runQuery(internal.users.internalGet, {
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
 * Fetches a single markdown file from GitHub, parses frontmatter, and
 * inserts it as a document. Throws on parse / fetch failures so the
 * caller can decide whether to abort or aggregate.
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

  let title: string = data.name.replace(/\.mdx?$/, "");
  let content: string = fileContent;
  let frontmatter: string | undefined;

  const frontmatterMatch = fileContent.match(
    /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/,
  );
  if (frontmatterMatch) {
    const rawFrontmatter = frontmatterMatch[1] ?? "";
    content = (frontmatterMatch[2] ?? "").trim();

    const fmObj: Record<string, string> = {};
    for (const line of rawFrontmatter.split("\n")) {
      const colonIdx = line.indexOf(":");
      if (colonIdx > 0) {
        const key = line.slice(0, colonIdx).trim();
        const value = line
          .slice(colonIdx + 1)
          .trim()
          .replace(/^["']|["']$/g, "");
        fmObj[key] = value;
      }
    }

    if (fmObj["title"]) {
      title = fmObj["title"];
    }

    frontmatter = JSON.stringify(fmObj);
  }

  const slug = data.name.replace(/\.mdx?$/, "");

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
    title,
    slug,
    content,
    githubPath: args.filePath,
    githubSha: githubSha,
  };

  if (frontmatter !== undefined) {
    mutationArgs.frontmatter = frontmatter;
  }

  const documentId = await ctx.runMutation(
    api.documents.importFromGithub,
    mutationArgs,
  );

  return { documentId, title, slug };
}

/**
 * Imports a single markdown file from a GitHub repo into the project.
 */
export const importFileFromGithub = action({
  args: {
    projectId: v.id("projects"),
    filePath: v.string(),
  },
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
 * Batch variant of {@link importFileFromGithub}. Auth, project lookup,
 * token resolution, and Octokit setup happen ONCE for the whole batch
 * instead of once per file, and the entire loop runs server-side so
 * there is exactly one client → Convex round-trip regardless of file
 * count. Charges a single token in the `github:importFile` rate-limit
 * bucket, so a 100-file import counts as one "call" against the limit.
 *
 * The action never throws on a per-file error; it returns
 * `{ succeeded, failed }` so the UI can summarise the result.
 */
export const importFilesFromGithub = action({
  args: {
    projectId: v.id("projects"),
    filePaths: v.array(v.string()),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{
    succeeded: Array<{ filePath: string; documentId: string; title: string }>;
    failed: Array<{ filePath: string; error: string }>;
  }> => {
    if (args.filePaths.length === 0) {
      return { succeeded: [], failed: [] };
    }
    // Hard cap so a single call can't keep the action alive past the
    // Convex action timeout on huge archives.
    if (args.filePaths.length > 200) {
      throw new Error("Cannot import more than 200 files in a single batch");
    }

    const key = await getRateLimitKey(ctx);
    await rateLimiter.limit(ctx, "github:importFile", { key, throws: true });

    const setup = await resolveGithubImportContext(ctx, {
      projectId: args.projectId,
    });

    const succeeded: Array<{
      filePath: string;
      documentId: string;
      title: string;
    }> = [];
    const failed: Array<{ filePath: string; error: string }> = [];

    for (const filePath of args.filePaths) {
      try {
        const result = await importOneFile(ctx, {
          ...setup,
          projectId: args.projectId,
          filePath,
        });
        succeeded.push({
          filePath,
          documentId: result.documentId,
          title: result.title,
        });
      } catch (err) {
        failed.push({
          filePath,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    return { succeeded, failed };
  },
});

/**
 * Validates that a GitHub token has access to the specified repository.
 * Returns a result object instead of throwing so the UI can display inline errors.
 */
export const verifyRepoAccess = action({
  args: {
    token: v.string(),
    repo: v.string(),
  },
  handler: async (_ctx, args): Promise<{ valid: boolean; error?: string }> => {
    const key = await getRateLimitKey(_ctx);
    await rateLimiter.limit(_ctx, "github:verifyRepoAccess", {
      key,
      throws: true,
    });

    const { owner, repo } = parseRepoString(args.repo);

    try {
      const octokit = new Octokit({ auth: args.token });
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
  handler: async (ctx, args): Promise<void> => {
    const key = await getRateLimitKey(ctx);
    await rateLimiter.limit(ctx, "github:deleteFile", { key, throws: true });

    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const project = await ctx.runQuery(internal.projects.internalGet, {
      projectId: args.projectId,
    });
    if (!project) {
      throw new Error("Project not found");
    }

    const user = await ctx.runQuery(internal.users.internalGet, {
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
  },
});
