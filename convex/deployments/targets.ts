/**
 * Deployment targets — per-project host integrations used by deployment
 * verification (convex/deployments/verify.ts). Provider tokens go straight
 * into the secret store (WorkOS Vault); only the vault id is persisted.
 */
import { v } from "convex/values";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import {
  action,
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "../_generated/server";
import { getAuthedUserOrNull, getCurrentUser } from "../_lib/auth";

/** Targets for the settings UI — never exposes the vault secret id. */
export const list = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    const user = await getAuthedUserOrNull(ctx);
    if (!user) return [];
    const project = await ctx.db.get(args.projectId);
    if (!project || project.userId !== user._id) return [];
    const targets = await ctx.db
      .query("deployment_targets")
      .withIndex("by_projectId", (q) => q.eq("projectId", args.projectId))
      .collect();
    return targets.map((t) => ({
      _id: t._id,
      provider: t.provider,
      providerProjectId: t.providerProjectId,
      teamId: t.teamId ?? null,
      enabled: t.enabled,
      createdAt: t.createdAt,
    }));
  },
});

/** Ownership gate shared by the connect action (auth propagates into it). */
export const assertOwner = internalQuery({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    const user = await getAuthedUserOrNull(ctx);
    if (!user) throw new Error("Not authenticated");
    const project = await ctx.db.get(args.projectId);
    if (!project || project.userId !== user._id) {
      throw new Error("Project not found");
    }
    return { userId: user._id };
  },
});

/**
 * Connect a Vercel project. Validates the token against the Vercel API
 * before saving (fail fast, precise error) and normalizes the project name
 * to its stable ID.
 */
export const connectVercel = action({
  args: {
    projectId: v.id("projects"),
    token: v.string(),
    /** Vercel project name or ID, exactly as shown in the Vercel dashboard */
    vercelProject: v.string(),
    teamId: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args): Promise<null> => {
    const { userId }: { userId: Id<"users"> } = await ctx.runQuery(
      internal.deployments.targets.assertOwner,
      { projectId: args.projectId },
    );

    const token = args.token.trim();
    const teamId = args.teamId?.trim() || undefined;
    const params = new URLSearchParams();
    if (teamId) params.set("teamId", teamId);
    const res = await fetch(
      `https://api.vercel.com/v9/projects/${encodeURIComponent(args.vercelProject.trim())}?${params}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (res.status === 401 || res.status === 403) {
      throw new Error(
        "Vercel rejected this token. Create one at vercel.com/account/settings/tokens with access to the project's scope.",
      );
    }
    if (res.status === 404) {
      throw new Error(
        "Vercel project not found. Use the project name or ID exactly as shown in Vercel — and the team ID if the project lives in a team.",
      );
    }
    if (!res.ok) {
      throw new Error(`Vercel API error (${res.status}). Please try again.`);
    }
    const vercelProject = (await res.json()) as { id: string };

    const secret: { id: string } = await ctx.runAction(
      internal.integrations.secretStore._create,
      {
        value: token,
        meta: {
          userId,
          projectId: args.projectId,
          provider: "vercel",
          label: "vercel-token",
        },
      },
    );

    await ctx.runMutation(internal.deployments.targets.insertTarget, {
      projectId: args.projectId,
      userId,
      providerProjectId: vercelProject.id,
      vaultSecretId: secret.id,
      ...(teamId ? { teamId } : {}),
    });
    return null;
  },
});

export const insertTarget = internalMutation({
  args: {
    projectId: v.id("projects"),
    userId: v.id("users"),
    providerProjectId: v.string(),
    teamId: v.optional(v.string()),
    vaultSecretId: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.insert("deployment_targets", {
      ...args,
      provider: "vercel",
      enabled: true,
      createdAt: Date.now(),
    });
    return null;
  },
});

export const remove = mutation({
  args: { targetId: v.id("deployment_targets") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    const target = await ctx.db.get(args.targetId);
    if (!target || target.userId !== user._id) {
      throw new Error("Deployment target not found");
    }
    await ctx.db.delete(args.targetId);
    // Best-effort vault cleanup — the token is useless without the row.
    await ctx.scheduler.runAfter(0, internal.integrations.secretStore._delete, {
      id: target.vaultSecretId,
    });
    return null;
  },
});
