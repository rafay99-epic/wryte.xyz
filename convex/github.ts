/**
 * GitHub integration actions for publishing documents and managing media.
 * Runs in a Node.js environment ("use node") because it depends on Octokit.
 *
 * Token fallback pattern: Every action that talks to GitHub accepts an optional
 * `githubAccessToken` arg. If provided (e.g., from a fresh OAuth flow), it takes
 * precedence; otherwise the token stored on the user record is used. This lets
 * scheduled/internal actions work without a client-supplied token while still
 * allowing the client to pass a token directly when available.
 */
"use node";

import { Octokit } from "@octokit/rest";
import { v } from "convex/values";
import { api, internal } from "./_generated/api";
import { action, internalAction } from "./_generated/server";

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
 * Internal action that performs the actual GitHub commit for publishing a document.
 * Builds the markdown file from document content + frontmatter, then creates or
 * updates the file in the configured repository via the GitHub Contents API.
 *
 * If the document already has a `githubSha`, it's used for the update; otherwise
 * the action checks GitHub for an existing file at the target path to avoid
 * conflicts (e.g., if the file was created outside the app).
 *
 * After a successful commit, updates the document record with the new SHA and path.
 *
 * @param args.documentId - The document to publish.
 * @param args.githubAccessToken - Optional override token (falls back to user's stored token).
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

    // Token fallback: prefer explicitly passed token, then user's stored token
    const token = args.githubAccessToken ?? user.githubAccessToken;
    if (!token) {
      throw new Error("No GitHub access token available");
    }

    if (!project.githubRepo) {
      throw new Error("GitHub repository not configured for this project");
    }

    const { owner, repo } = parseRepoString(project.githubRepo);
    const branch = project.githubBranch ?? "main";
    const contentPath = project.contentPath ?? "content";
    const filePath = `${contentPath}/${document.slug}.md`;

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

    const octokit = new Octokit({ auth: token });

    // Use the stored SHA if available; otherwise probe GitHub to detect
    // a pre-existing file at this path (avoids 409 conflict on create).
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
        // File doesn't exist yet, that's fine
      }
    }

    const commitMessage = existingSha
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

    // Determine the publish column ID — use custom board columns if configured
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

    await ctx.runMutation(internal.documents.internalUpdateAfterPublish, {
      documentId: args.documentId,
      githubPath: filePath,
      githubSha: newSha,
      status: publishStatus,
      publishedAt: Date.now(),
    });
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
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    // Verify ownership: document -> project -> user
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

    // Delegate to the internal action which does the actual GitHub work
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
 * Uploads a media file (image, etc.) to the project's GitHub repo.
 * Uses the GitHub Contents API to create or overwrite the file at the
 * configured media path. Returns the repo-relative path for embedding in documents.
 *
 * @requires Authentication + project ownership
 * @param args.base64Content - The file content, already base64-encoded.
 * @param args.fileName - Target filename within the media directory.
 * @param args.githubAccessToken - Optional override (falls back to stored token).
 * @returns The repo-relative file path (e.g., "/public/images/photo.png").
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

    // Token fallback: prefer explicitly passed token, then user's stored token
    const token = args.githubAccessToken ?? user.githubAccessToken;
    if (!token) {
      throw new Error("No GitHub access token available");
    }

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

    return `/${filePath}`;
  },
});

/**
 * Imports a single markdown file from a GitHub repo into the project.
 * Fetches the file via the Contents API, parses YAML frontmatter (extracting
 * `title` if present), and delegates to `documents.importFromGithub` which
 * handles duplicate detection by githubPath.
 *
 * @requires Authentication + project ownership
 * @param args.filePath - Path to the file in the repo (e.g., "content/hello.md").
 * @param args.githubAccessToken - Optional override (falls back to stored token).
 * @returns Object with documentId, title, and slug of the imported document.
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

    // Token fallback: prefer explicitly passed token, then user's stored token
    const token = args.githubAccessToken ?? user.githubAccessToken;
    if (!token) {
      throw new Error("No GitHub access token available");
    }

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

    // Split the file into YAML frontmatter and body content.
    // The frontmatter is parsed into a flat key-value JSON object for storage.
    let title: string = data.name.replace(/\.mdx?$/, "");
    let content: string = fileContent;
    let frontmatter: string | undefined;

    const frontmatterMatch = fileContent.match(
      /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/,
    );
    if (frontmatterMatch) {
      const rawFrontmatter = frontmatterMatch[1] ?? "";
      content = (frontmatterMatch[2] ?? "").trim();

      // Parse YAML frontmatter into a JSON string
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
 * Used during project setup to give the user immediate feedback before saving.
 * Returns a result object instead of throwing so the UI can display inline errors.
 *
 * @param args.token - GitHub personal access token to test.
 * @param args.repo - Repository in "owner/repo" format.
 * @returns { valid: boolean, error?: string }
 */
export const verifyRepoAccess = action({
  args: {
    token: v.string(),
    repo: v.string(),
  },
  handler: async (_ctx, args): Promise<{ valid: boolean; error?: string }> => {
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
 * Uses the GitHub Contents API to remove the file at the specified path,
 * requiring the current file SHA to prevent accidental deletions of stale content.
 *
 * @requires Authentication + project ownership
 * @param args.projectId - The project whose repo contains the file.
 * @param args.filePath - Path to the file in the repo (e.g., "content/hello.md").
 * @param args.sha - Current SHA of the file (used by GitHub to prevent conflicts).
 * @param args.githubAccessToken - Optional override (falls back to stored token).
 */
export const deleteFileFromGithub = action({
  args: {
    projectId: v.id("projects"),
    filePath: v.string(),
    sha: v.string(),
    githubAccessToken: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<void> => {
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

    // Token fallback: prefer explicitly passed token, then user's stored token
    const token = args.githubAccessToken ?? user.githubAccessToken;
    if (!token) {
      throw new Error("No GitHub access token available");
    }

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
