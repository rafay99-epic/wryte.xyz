"use node";

import { Octokit } from "@octokit/rest";
import { v } from "convex/values";
import { internal } from "../_generated/api";
import { action } from "../_generated/server";
import { withAttribution } from "../_lib/commitAttribution";
import {
  configFormatFromPath,
  isBrowsableConfigPath,
  MAX_CONFIG_BYTES,
  normalizeConfigPath,
  requireConfigFilePath,
} from "../_lib/configFiles";
import { resolveCommitClient } from "../_lib/githubApp";
import {
  type OwnedGithubProject,
  resolveOwnedGithubProject,
} from "../_lib/githubProject";
import { getRateLimitKey, rateLimiter } from "../_lib/rateLimits";

const MAX_LISTED_FILES = 2000;

type PublishResult =
  | { status: "published"; sha: string; commitUrl: string | null }
  | { status: "conflict" };

function errorStatus(error: unknown): number | undefined {
  if (
    typeof error === "object" &&
    error !== null &&
    "status" in error &&
    typeof error.status === "number"
  ) {
    return error.status;
  }
  return undefined;
}

async function readRepoFile(
  octokit: Octokit,
  target: Pick<OwnedGithubProject, "owner" | "repo" | "branch">,
  path: string,
): Promise<{ content: string; sha: string } | null> {
  try {
    const { data } = await octokit.repos.getContent({
      owner: target.owner,
      repo: target.repo,
      path,
      ref: target.branch,
    });
    if (Array.isArray(data) || data.type !== "file") return null;
    if (data.size > MAX_CONFIG_BYTES) {
      throw new Error("This file is too large to edit here (512 KB limit).");
    }
    return {
      content: Buffer.from(data.content, "base64").toString("utf-8"),
      sha: data.sha,
    };
  } catch (error: unknown) {
    if (errorStatus(error) === 404) return null;
    throw error;
  }
}

export const listFiles = action({
  args: { projectId: v.id("projects"), root: v.optional(v.string()) },
  returns: v.object({
    files: v.array(v.object({ path: v.string(), size: v.number() })),
    truncated: v.boolean(),
  }),
  handler: async (ctx, args) => {
    await rateLimiter.limit(ctx, "github:configRead", {
      key: await getRateLimitKey(ctx),
      throws: true,
    });
    const target = await resolveOwnedGithubProject(ctx, args.projectId);
    const octokit = new Octokit({ auth: target.token });
    const root = normalizeConfigPath(args.root ?? "");
    const prefix = root === "" ? "" : `${root}/`;

    const { data } = await octokit.git.getTree({
      owner: target.owner,
      repo: target.repo,
      tree_sha: target.branch,
      recursive: "1",
    });

    const files: { path: string; size: number }[] = [];
    for (const entry of data.tree) {
      if (entry.type !== "blob") continue;
      if (!entry.path.startsWith(prefix)) continue;
      if (!entry.path.includes("/")) continue;
      if (!isBrowsableConfigPath(entry.path)) continue;
      if (configFormatFromPath(entry.path) === null) continue;
      files.push({ path: entry.path, size: entry.size ?? 0 });
    }
    files.sort((a, b) => a.path.localeCompare(b.path));

    return {
      files: files.slice(0, MAX_LISTED_FILES),
      truncated: data.truncated || files.length > MAX_LISTED_FILES,
    };
  },
});

export const readFile = action({
  args: { projectId: v.id("projects"), path: v.string() },
  returns: v.object({ content: v.string(), sha: v.string() }),
  handler: async (ctx, args) => {
    await rateLimiter.limit(ctx, "github:configRead", {
      key: await getRateLimitKey(ctx),
      throws: true,
    });
    const target = await resolveOwnedGithubProject(ctx, args.projectId);
    requireConfigFilePath(target.project.configPath, args.path);
    const file = await readRepoFile(
      new Octokit({ auth: target.token }),
      target,
      args.path,
    );
    if (!file) throw new Error("That file no longer exists on GitHub.");
    return file;
  },
});

export const publish = action({
  args: {
    projectId: v.id("projects"),
    path: v.string(),
    overwrite: v.optional(v.boolean()),
  },
  returns: v.union(
    v.object({
      status: v.literal("published"),
      sha: v.string(),
      commitUrl: v.union(v.string(), v.null()),
    }),
    v.object({ status: v.literal("conflict") }),
  ),
  handler: async (ctx, args): Promise<PublishResult> => {
    await rateLimiter.limit(ctx, "github:configPublish", {
      key: await getRateLimitKey(ctx),
      throws: true,
    });
    const target = await resolveOwnedGithubProject(ctx, args.projectId);
    requireConfigFilePath(target.project.configPath, args.path);

    const draft = await ctx.runQuery(internal.cms.configFiles._getDraft, {
      projectId: args.projectId,
      path: args.path,
    });
    if (!draft) throw new Error("Nothing to publish for this file.");

    const { octokit, commitAuthor } = await resolveCommitClient({
      userToken: target.token,
      project: target.project,
      owner: target.owner,
      repo: target.repo,
      githubUsername: target.user.githubUsername,
    });

    const current = await readRepoFile(octokit, target, args.path);
    if (!current) throw new Error("That file no longer exists on GitHub.");
    if (current.sha !== draft.baseSha && !args.overwrite) {
      return { status: "conflict" };
    }

    if (current.content === draft.content) {
      await ctx.runMutation(internal.cms.configFiles._settlePublishedDraft, {
        projectId: args.projectId,
        path: args.path,
        publishedUpdatedAt: draft.updatedAt,
        newSha: current.sha,
      });
      return {
        status: "published",
        sha: current.sha,
        commitUrl: null,
      };
    }

    const filename = args.path.slice(args.path.lastIndexOf("/") + 1);
    const message = withAttribution(`chore(config): update ${filename}`, {
      enabled: target.project.commitAttribution !== false,
      customText: target.project.commitAttributionText,
    });

    try {
      const { data } = await octokit.repos.createOrUpdateFileContents({
        owner: target.owner,
        repo: target.repo,
        path: args.path,
        message,
        content: Buffer.from(draft.content, "utf-8").toString("base64"),
        branch: target.branch,
        sha: current.sha,
        ...(commitAuthor ? { author: commitAuthor } : {}),
      });
      const sha = data.content?.sha ?? current.sha;
      await ctx.runMutation(internal.cms.configFiles._settlePublishedDraft, {
        projectId: args.projectId,
        path: args.path,
        publishedUpdatedAt: draft.updatedAt,
        newSha: sha,
      });
      return {
        status: "published",
        sha,
        commitUrl: data.commit.html_url ?? null,
      };
    } catch (error: unknown) {
      const status = errorStatus(error);
      if (status === 409) return { status: "conflict" };
      if (status === 401) {
        throw new Error(
          "GitHub token expired or revoked. Please reconnect GitHub in settings.",
        );
      }
      if (status === 403 || status === 404) {
        throw new Error(
          `GitHub refused the commit to ${target.owner}/${target.repo}. Check that you have write access and the branch "${target.branch}" exists.`,
        );
      }
      throw error;
    }
  },
});
