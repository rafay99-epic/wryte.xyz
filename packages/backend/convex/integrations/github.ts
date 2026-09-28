"use node";

import { Octokit } from "@octokit/rest";
import { v } from "convex/values";
import { stringify as stringifyToml } from "smol-toml";
import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import type { ActionCtx } from "../_generated/server";
import { action, internalAction } from "../_generated/server";
import {
  describePublishBlockers,
  findPublishBlockers,
} from "../_lib/animationChecks";
import {
  transformMdxWithAnimations,
  WRYTE_MANAGED_MARKER,
} from "../_lib/animationTransform";
import { getGithubToken } from "../_lib/auth";
import {
  type CommitTemplateVars,
  renderCommitTemplate,
  withAttribution,
} from "../_lib/commitAttribution";
import { coerceFrontmatterArrays } from "../_lib/frontmatter";
import { type CommitAuthor, resolveCommitClient } from "../_lib/githubApp";
import { buildPublishedUrl } from "../_lib/publishedUrl";
import { getRateLimitKey, rateLimiter } from "../_lib/rateLimits";
import { importPool } from "../_pools/import";

const IMPORTED_FILE_RESULT = v.object({
  documentId: v.string(),
  title: v.string(),
  slug: v.string(),
});

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

function stripNullish(
  frontmatter: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(frontmatter)) {
    if (value !== null && value !== undefined) out[key] = value;
  }
  return out;
}

function buildContentFile(
  frontmatter: Record<string, unknown>,
  content: string,
  format: "yaml" | "toml" | undefined,
): string {
  if (format === "toml") {
    try {
      const toml = stringifyToml(stripNullish(frontmatter)).trim();
      return `+++\n${toml}\n+++\n\n${content}\n`;
    } catch {}
  }
  return buildMarkdownFile(frontmatter, content);
}

const PUB_DATE_FIELD_CANDIDATES = ["pubDate", "publishDate", "date"] as const;

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

function parseRepoString(repo: string): { owner: string; repo: string } {
  const parts = repo.split("/");
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    throw new Error(`Invalid repo format: "${repo}". Expected "owner/repo".`);
  }
  return { owner: parts[0], repo: parts[1] };
}

function normalizeRepoPath(path: string): string {
  return path.replace(/^\/+/, "").replace(/\/+$/, "");
}

function joinRepoPath(prefix: string, filename: string): string {
  const cleanPrefix = normalizeRepoPath(prefix);
  return cleanPrefix ? `${cleanPrefix}/${filename}` : filename;
}

async function animationComponentNeedsCommit(
  octokit: Octokit,
  opts: {
    owner: string;
    repo: string;
    branch: string;
    repoPath: string;
    fileContent: string;
    name: string;
  },
): Promise<boolean> {
  try {
    const { data } = await octokit.repos.getContent({
      owner: opts.owner,
      repo: opts.repo,
      path: opts.repoPath,
      ref: opts.branch,
    });
    if (!Array.isArray(data) && data.type === "file") {
      const existingContent = Buffer.from(data.content, "base64").toString(
        "utf-8",
      );
      if (existingContent === opts.fileContent) return false;
      if (!existingContent.includes(WRYTE_MANAGED_MARKER)) {
        throw new Error(
          `Can't publish animation "${opts.name}": ${opts.repoPath} already exists in the repo and wasn't generated by Wryte. Rename the animation or move the existing file.`,
        );
      }
      return true;
    }
    return true;
  } catch (error: unknown) {
    const err = error as { status?: number; message?: string };
    if (err.status !== 404) throw error;
    return true;
  }
}

async function commitPostWithComponents(
  octokit: Octokit,
  opts: {
    owner: string;
    repo: string;
    branch: string;
    filePath: string;
    fileContent: string;
    components: { repoPath: string; fileContent: string }[];
    message: string;
    commitAuthor: CommitAuthor | null;
  },
): Promise<{ fileSha: string; commitSha: string; commitUrl?: string }> {
  const { owner, repo, branch } = opts;

  const { data: ref } = await octokit.git.getRef({
    owner,
    repo,
    ref: `heads/${branch}`,
  });
  const parentSha = ref.object.sha;

  const { data: parentCommit } = await octokit.git.getCommit({
    owner,
    repo,
    commit_sha: parentSha,
  });

  const { data: tree } = await octokit.git.createTree({
    owner,
    repo,
    base_tree: parentCommit.tree.sha,
    tree: [
      {
        path: opts.filePath,
        mode: "100644" as const,
        type: "blob" as const,
        content: opts.fileContent,
      },
      ...opts.components.map((c) => ({
        path: c.repoPath,
        mode: "100644" as const,
        type: "blob" as const,
        content: c.fileContent,
      })),
    ],
  });

  const { data: commit } = await octokit.git.createCommit({
    owner,
    repo,
    message: opts.message,
    tree: tree.sha,
    parents: [parentSha],
    ...(opts.commitAuthor ? { author: opts.commitAuthor } : {}),
  });

  await octokit.git.updateRef({
    owner,
    repo,
    ref: `heads/${branch}`,
    sha: commit.sha,
  });

  const { data: fileData } = await octokit.repos.getContent({
    owner,
    repo,
    path: opts.filePath,
    ref: commit.sha,
  });
  if (Array.isArray(fileData) || fileData.type !== "file") {
    throw new Error("Committed post file not found after tree commit");
  }

  return {
    fileSha: fileData.sha,
    commitSha: commit.sha,
    commitUrl: commit.html_url ?? undefined,
  };
}

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
  } catch {}

  try {
    const r = await octokit.repos.get({ owner, repo: repoName });
    defaultBranch = r.data.default_branch;
  } catch {}

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
  } catch {}

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
  let actingAs: string | null = null;
  let scopes: string | null = null;
  try {
    const me = await octokit.users.getAuthenticated();
    actingAs = me.data.login;
    const headerScopes = me.headers["x-oauth-scopes"];
    scopes = typeof headerScopes === "string" ? headerScopes : null;
  } catch {
    return "GitHub token is invalid or revoked — reconnect GitHub in Settings.";
  }

  try {
    const r = await octokit.repos.get({ owner, repo: repoName });
    if (!r.data.permissions?.push) {
      return `Connected as @${actingAs}, but that account has no write access to ${owner}/${repoName}. Either grant push permission to @${actingAs} on the repo, or set a Personal Access Token with 'repo' scope in Settings.`;
    }
    return `Connected as @${actingAs} with write access to ${owner}/${repoName}, but the publish still 404'd — most likely the branch doesn't exist. Check the branch name in project settings.`;
  } catch {
    const scopeHint = scopes
      ? scopes.includes("repo")
        ? ""
        : ` (current OAuth scopes: \`${scopes}\` — missing \`repo\`)`
      : " (could not read OAuth scopes from GitHub response)";
    return `${owner}/${repoName} is not visible to GitHub user @${actingAs}${scopeHint}. Fixes: (a) add \`repo\` scope to your Clerk GitHub OAuth provider config and reconnect GitHub, (b) sign in with the GitHub account that owns this repo, or (c) set a Personal Access Token with \`repo\` scope in Settings.`;
  }
}

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

export const publishToGithub = internalAction({
  args: {
    documentId: v.id("documents"),
    commitMessage: v.optional(v.string()),
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

    const { octokit, commitAuthor } = await resolveCommitClient({
      userToken: token,
      project,
      owner,
      repo,
      githubUsername: user.githubUsername,
    });

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
      } catch {}
    }

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

    frontmatterData = coerceFrontmatterArrays(
      frontmatterData,
      project.frontmatterSchema,
    );

    let publishBody = document.content;
    const pendingComponents: { repoPath: string; fileContent: string }[] = [];
    if (
      project.contentFormat === "mdx" &&
      project.animationsPath &&
      project.animationsEnabled !== false
    ) {
      const animationRows = await ctx.runQuery(
        internal.cms.animations.internalListByProject,
        { projectId: project._id },
      );
      if (animationRows.length > 0) {
        const sources: Record<string, string> = {};
        for (const row of animationRows) sources[row.name] = row.source;
        const transformed = transformMdxWithAnimations(publishBody, sources, {
          framework: project.framework,
          contentDir: normalizeRepoPath(project.contentPath ?? "content"),
          animationsDir: project.animationsPath,
          language: project.animationLanguage,
        });
        publishBody = transformed.body;

        const policy = project.animationChecks;
        if (policy?.blockPublish && policy.level !== "off") {
          const referenced = new Set(transformed.components.map((c) => c.name));
          const blockers = findPublishBlockers(
            policy.level,
            animationRows.filter((row) => referenced.has(row.name)),
          );
          if (blockers.length > 0) {
            throw new Error(describePublishBlockers(blockers));
          }
        }

        for (const comp of transformed.components) {
          const needed = await animationComponentNeedsCommit(octokit, {
            owner,
            repo,
            branch,
            repoPath: comp.repoPath,
            fileContent: comp.fileContent,
            name: comp.name,
          });
          if (needed) {
            pendingComponents.push({
              repoPath: comp.repoPath,
              fileContent: comp.fileContent,
            });
          }
        }
      }
    }

    const fileContent = buildContentFile(
      frontmatterData,
      publishBody,
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
    const templateVars: CommitTemplateVars = {
      title: document.title,
      slug: document.slug,
      filename: `${document.slug}${ext}`,
      date: new Date().toISOString().slice(0, 10),
    };
    const baseMessage =
      args.commitMessage?.trim() ||
      (project.commitMessageTemplate
        ? renderCommitTemplate(project.commitMessageTemplate, templateVars)
        : isUpdate
          ? `Update ${document.title}`
          : `Add ${document.title}`);
    const animationNote =
      pendingComponents.length > 0
        ? ` (+${String(pendingComponents.length)} animation component${pendingComponents.length === 1 ? "" : "s"})`
        : "";
    const commitMessage = withAttribution(baseMessage + animationNote, {
      enabled: project.commitAttribution !== false,
      customText: project.commitAttributionText,
      vars: templateVars,
    });

    console.info(
      `[publishToGithub] PUT owner=${owner} repo=${repo} branch=${JSON.stringify(branch)} path=${JSON.stringify(filePath)} existingSha=${existingSha ? "<set>" : "<none>"} contentBytes=${base64Content.length} animationComponents=${String(pendingComponents.length)}`,
    );

    let newSha: string;
    let commitSha: string | undefined;
    let commitUrl: string | undefined;

    if (pendingComponents.length > 0) {
      const result = await commitPostWithComponents(octokit, {
        owner,
        repo,
        branch,
        filePath,
        fileContent,
        components: pendingComponents,
        message: commitMessage,
        commitAuthor,
      });
      newSha = result.fileSha;
      commitSha = result.commitSha;
      commitUrl = result.commitUrl;
    } else {
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
          ...(commitAuthor ? { author: commitAuthor } : {}),
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
          const diag = await diagnoseBranchAndRepo(
            octokit,
            owner,
            repo,
            branch,
          );
          console.error(`[publishToGithub] post-404 diagnosis:`, diag);
          const why = await describeWriteFailure(octokit, owner, repo);
          throw new Error(
            `GitHub publish failed: ${why} (branch="${branch}", path="${filePath}")`,
          );
        }
        throw error;
      }

      const contentSha = response.data.content?.sha;
      if (!contentSha) {
        throw new Error("GitHub API did not return a file SHA");
      }
      newSha = contentSha;
      commitSha = response.data.commit?.sha;
      commitUrl = response.data.commit?.html_url ?? undefined;
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
      } catch {}
    }

    let publishStatus = "published";
    if (project.boardColumns) {
      try {
        const columns = JSON.parse(project.boardColumns) as Array<{
          id: string;
          behavior: string;
        }>;
        const publishCol = columns.find((c) => c.behavior === "publish");
        if (publishCol) publishStatus = publishCol.id;
      } catch {}
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

    if (project.syndicateOnPublish) {
      await ctx.scheduler.runAfter(
        0,
        internal.syndication.post.syndicatePublish,
        { projectId: project._id, documentId: document._id },
      );
    }
    return null;
  },
});

export const publish = action({
  args: {
    documentId: v.id("documents"),
    commitMessage: v.optional(v.string()),
    socialPostText: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args): Promise<null> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const user = await ctx.runQuery(internal.account.users.internalGetByToken, {
      tokenIdentifier: identity.tokenIdentifier,
    });
    if (!user) throw new Error("User not found");
    return await publishForUser(ctx, user, args);
  },
});

async function publishForUser(
  ctx: ActionCtx,
  user: Doc<"users">,
  args: {
    documentId: Id<"documents">;
    commitMessage?: string;
    socialPostText?: string;
  },
): Promise<null> {
  {
    await rateLimiter.limit(ctx, "github:publish", {
      key: user.tokenIdentifier,
      throws: true,
    });

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

    if (project.userId !== user._id) {
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
  }
}

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

    const { octokit, commitAuthor } = await resolveCommitClient({
      userToken: token,
      project,
      owner,
      repo,
      githubUsername: user.githubUsername,
    });

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
          } catch {}
        }

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
    const soleEntry = docFileMap.length === 1 ? docFileMap[0] : undefined;
    const bulkTemplateVars: CommitTemplateVars | undefined = soleEntry
      ? {
          title: soleEntry.doc.title,
          slug: soleEntry.doc.slug,
          filename: soleEntry.filePath.split("/").pop() ?? "",
          date: new Date().toISOString().slice(0, 10),
        }
      : undefined;
    const baseBulkMessage =
      soleEntry && project.commitMessageTemplate && bulkTemplateVars
        ? renderCommitTemplate(project.commitMessageTemplate, bulkTemplateVars)
        : titles.length === 1
          ? `Publish ${titles[0]}`
          : `Publish ${String(titles.length)} articles: ${titles.slice(0, 3).join(", ")}${titles.length > 3 ? "..." : ""}`;
    const commitMessage = withAttribution(baseBulkMessage, {
      enabled: project.commitAttribution !== false,
      customText: project.commitAttributionText,
      vars: bulkTemplateVars,
    });

    const { data: newCommit } = await octokit.git.createCommit({
      owner,
      repo,
      message: commitMessage,
      tree: newTree.sha,
      parents: [baseCommitSha],
      ...(commitAuthor ? { author: commitAuthor } : {}),
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
      } catch {}
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

      if (project.syndicateOnPublish) {
        await ctx.scheduler.runAfter(
          0,
          internal.syndication.post.syndicatePublish,
          { projectId: project._id, documentId: entry.doc.id },
        );
      }
    }

    return {
      success: docFileMap.length,
      failed,
      commitUrl,
    };
  },
});

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

      if (!remoteSha) {
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
      const lastSync = local.githubSyncedAt ?? local.updatedAt;
      if (local.updatedAt <= lastSync) {
        toEnqueue.push({ path, mode: "fastForward" });
      } else {
        conflictCandidates.push({
          path,
          documentId: local.documentId,
          remoteSha,
          localContentSnapshot: local.content,
          localFrontmatterSnapshot: local.frontmatter,
        });
      }
    }

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

    if (toEnqueue.length === 0) {
      return {
        batchId: null,
        counts,
        conflicts,
        missing,
      };
    }

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

export const _deleteOneJob = internalAction({
  args: {
    batchId: v.id("delete_batches"),
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
    if (args.mode !== "github" && args.documentId) {
      await ctx.runMutation(internal.cms.documents._removeInternal, {
        documentId: args.documentId,
        projectId: args.projectId,
      });
    }

    if (args.mode !== "local") {
      if (
        !args.token ||
        !args.owner ||
        !args.repo ||
        !args.branch ||
        !args.filePath ||
        !args.githubSha
      ) {
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
          return null;
        }
        throw err;
      }
    }
    return null;
  },
});

export type BulkDeleteResult = {
  batchId: Id<"delete_batches"> | null;
  inlineSummary?: {
    total: number;
    succeeded: number;
    failed: number;
    errors: Array<{ label: string; message: string }>;
  };
};

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

export const startBulkDelete = action({
  args: {
    projectId: v.id("projects"),
    mode: v.union(v.literal("local"), v.literal("github"), v.literal("both")),
    items: v.array(
      v.object({
        documentId: v.optional(v.id("documents")),
        filePath: v.optional(v.string()),
        githubSha: v.optional(v.string()),
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
