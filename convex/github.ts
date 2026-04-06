"use node";

import { Octokit } from "@octokit/rest";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { action, internalAction } from "./_generated/server";

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

function parseRepoString(repo: string): { owner: string; repo: string } {
  const parts = repo.split("/");
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    throw new Error(
      `Invalid repo format: "${repo}". Expected "owner/repo".`,
    );
  }
  return { owner: parts[0], repo: parts[1] };
}

export const publishToGithub = internalAction({
  args: { documentId: v.id("documents") },
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

    if (!user.githubAccessToken) {
      throw new Error("GitHub access token not configured for this user");
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

    const octokit = new Octokit({ auth: user.githubAccessToken });

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
          throw new Error(`Failed to check existing file: ${err.message ?? "Unknown error"}`);
        }
        // File doesn't exist yet, that's fine
      }
    }

    const commitMessage = existingSha
      ? `Update ${document.title}`
      : `Add ${document.title}`;

    const response = await octokit.repos.createOrUpdateFileContents({
      owner,
      repo,
      path: filePath,
      message: commitMessage,
      content: base64Content,
      branch,
      ...(existingSha ? { sha: existingSha } : {}),
    });

    const newSha = response.data.content?.sha;
    if (!newSha) {
      throw new Error("GitHub API did not return a file SHA");
    }

    await ctx.runMutation(internal.documents.internalUpdateAfterPublish, {
      documentId: args.documentId,
      githubPath: filePath,
      githubSha: newSha,
      status: "published",
      publishedAt: Date.now(),
    });
  },
});

/**
 * Public action callable from the client. Authenticates the user,
 * verifies document ownership, then delegates to the internal publish action.
 */
export const publish = action({
  args: { documentId: v.id("documents") },
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
    await ctx.runAction(internal.github.publishToGithub, {
      documentId: args.documentId,
    });
  },
});

export const uploadMediaToGithub = action({
  args: {
    projectId: v.id("projects"),
    fileName: v.string(),
    base64Content: v.string(),
    contentType: v.string(),
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

    if (!user.githubAccessToken) {
      throw new Error("GitHub access token not configured");
    }

    if (!project.githubRepo) {
      throw new Error("GitHub repository not configured");
    }

    const { owner, repo } = parseRepoString(project.githubRepo);
    const branch = project.githubBranch ?? "main";
    const mediaPath = project.mediaPath ?? "public/images";
    const filePath = `${mediaPath}/${args.fileName}`;

    const octokit = new Octokit({ auth: user.githubAccessToken });

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
        throw new Error(`Failed to check existing file: ${err.message ?? "Unknown error"}`);
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
