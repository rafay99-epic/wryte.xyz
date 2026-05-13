/**
 * GitHub integration actions for publishing documents and managing media.
 * Runs in a Node.js environment ("use node") because it depends on Octokit.
 *
 * Token sourcing: the GitHub PAT now lives in the secret vault. All actions
 * resolve it via `getGithubToken(ctx, user._id)`. Callers can still pass
 * `args.githubAccessToken` as an override (used by the OAuth refresh path
 * in the settings page), but the canonical source is the vault.
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
 * Resolves the token to use for an action: explicit override > vault.
 * Throws if neither path yields a token so the caller surfaces a clear
 * "Reconnect GitHub" message.
 */
async function resolveToken(
  ctx: ActionCtx,
  userId: Id<"users">,
  override?: string,
): Promise<string> {
  if (override) return override;
  const token = await getGithubToken(ctx, userId);
  if (!token) {
    throw new Error("No GitHub access token available");
  }
  return token;
}

/**
 * Internal action that performs the actual GitHub commit for publishing a document.
 * Builds the markdown file from document content + frontmatter, then creates or
 * updates the file in the configured repository via the GitHub Contents API.
 *
 * @param args.documentId - The document to publish.
 * @param args.githubAccessToken - Optional override token (falls back to vault).
 */
export const publishToGithub = internalAction({
  args: {
    documentId: v.id("documents"),
    githubAccessToken: v.optional(v.string()),
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

    const token = await resolveToken(ctx, user._id, args.githubAccessToken);

    if (!project.githubRepo) {
      throw new Error("GitHub repository not configured for this project");
    }

    const { owner, repo } = parseRepoString(project.githubRepo);
    const branch = project.githubBranch ?? "main";
    const contentPath = project.contentPath ?? "content";
    const filePath = `${contentPath}/${document.slug}.md`;

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
    githubAccessToken: v.optional(v.string()),
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

    const runArgs: {
      documentId: typeof args.documentId;
      githubAccessToken?: string;
    } = {
      documentId: args.documentId,
    };
    if (args.githubAccessToken !== undefined) {
      runArgs.githubAccessToken = args.githubAccessToken;
    }
    await ctx.runAction(internal.github.publishToGithub, runArgs);
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
    githubAccessToken: v.optional(v.string()),
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

    const token = await resolveToken(ctx, user._id, args.githubAccessToken);
    if (!project.githubRepo) {
      throw new Error("GitHub repository not configured for this project");
    }

    const { owner, repo } = parseRepoString(project.githubRepo);
    const branch = project.githubBranch ?? "main";
    const contentPath = project.contentPath ?? "content";

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
        const filePath = `${contentPath}/${doc.slug}.md`;
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
    githubAccessToken: v.optional(v.string()),
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

    const token = await resolveToken(ctx, user._id, args.githubAccessToken);

    if (!project.githubRepo) {
      throw new Error("GitHub repository not configured");
    }

    const { owner, repo } = parseRepoString(project.githubRepo);
    const branch = project.githubBranch ?? "main";
    const mediaPath = project.mediaPath ?? "public/images";
    const filePath = `${mediaPath}/${args.fileName}`;

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
 * Imports a single markdown file from a GitHub repo into the project.
 */
export const importFileFromGithub = action({
  args: {
    projectId: v.id("projects"),
    filePath: v.string(),
    githubAccessToken: v.optional(v.string()),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{ documentId: string; title: string; slug: string }> => {
    const key = await getRateLimitKey(ctx);
    await rateLimiter.limit(ctx, "github:importFile", { key, throws: true });

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

    const token = await resolveToken(ctx, user._id, args.githubAccessToken);

    if (!project.githubRepo) {
      throw new Error("GitHub repository not configured for this project");
    }

    const { owner, repo } = parseRepoString(project.githubRepo);
    const branch: string = project.githubBranch ?? "main";

    const octokit = new Octokit({ auth: token });

    const { data } = await octokit.repos.getContent({
      owner,
      repo,
      path: args.filePath,
      ref: branch,
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
      projectId: typeof args.projectId;
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
    githubAccessToken: v.optional(v.string()),
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

    const token = await resolveToken(ctx, user._id, args.githubAccessToken);

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
