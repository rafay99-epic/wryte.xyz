"use node";

import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import type { ActionCtx } from "../_generated/server";
import { getGithubToken } from "./auth";

export function parseRepoString(repo: string): { owner: string; repo: string } {
  const parts = repo.split("/");
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    throw new Error(`Invalid repo format: "${repo}". Expected "owner/repo".`);
  }
  return { owner: parts[0], repo: parts[1] };
}

export async function resolveToken(
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

export type OwnedGithubProject = {
  project: Doc<"projects">;
  user: Doc<"users">;
  token: string;
  owner: string;
  repo: string;
  branch: string;
};

export async function resolveOwnedGithubProject(
  ctx: ActionCtx,
  projectId: Id<"projects">,
): Promise<OwnedGithubProject> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error("Not authenticated");

  const project = await ctx.runQuery(internal.cms.projects.internalGet, {
    projectId,
  });
  if (!project) throw new Error("Project not found");

  const user = await ctx.runQuery(internal.account.users.internalGet, {
    userId: project.userId,
  });
  if (!user) throw new Error("User not found");
  if (user.tokenIdentifier !== identity.tokenIdentifier) {
    throw new Error("Unauthorized: you do not own this project");
  }
  if (!project.githubRepo) {
    throw new Error("GitHub repository not configured for this project");
  }

  const token = await resolveToken(ctx, user._id);
  const { owner, repo } = parseRepoString(project.githubRepo);
  return {
    project,
    user,
    token,
    owner,
    repo,
    branch: project.githubBranch ?? "main",
  };
}
