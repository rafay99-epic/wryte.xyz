/**
 * Analytics connection lifecycle — lean connect/remove/list, modeled on
 * `deployments/targets.ts` (validate-then-vault, fail-fast with the exact
 * provider error; no rotate/test CRUD for a read-only key). Default Convex
 * runtime — clients use `fetch` only; the vault is reached via the node
 * internal actions in `integrations/secretStore`.
 */

import { ConvexError, v } from "convex/values";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import type { ActionCtx, MutationCtx } from "../_generated/server";
import {
  action,
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "../_generated/server";
import { getAuthedUserOrNull, getCurrentUser } from "../_lib/auth";
import { getRateLimitKey, rateLimiter } from "../_lib/rateLimits";
import { analyticsProviderValidator } from "./_lib/providers";
import { validatePlausible } from "./plausible";
import { resolveUmamiWebsite } from "./umami";

const TARGET_DOC = v.object({
  _id: v.id("analytics_targets"),
  _creationTime: v.number(),
  projectId: v.id("projects"),
  userId: v.id("users"),
  provider: analyticsProviderValidator,
  mode: v.optional(v.union(v.literal("api"), v.literal("share"))),
  vaultSecretId: v.optional(v.string()),
  shareUrl: v.optional(v.string()),
  embedBlocked: v.optional(v.boolean()),
  baseUrl: v.optional(v.string()),
  siteId: v.string(),
  enabled: v.optional(v.boolean()),
  status: v.union(v.literal("active"), v.literal("invalid")),
  lastError: v.optional(v.string()),
  createdAt: v.number(),
  updatedAt: v.number(),
});

/** The project's connection, minus the vault id — for the settings card. */
export const get = query({
  args: { projectId: v.id("projects") },
  returns: v.union(
    v.null(),
    v.object({
      _id: v.id("analytics_targets"),
      provider: analyticsProviderValidator,
      mode: v.union(v.literal("api"), v.literal("share")),
      shareUrl: v.optional(v.string()),
      embedBlocked: v.boolean(),
      baseUrl: v.optional(v.string()),
      siteId: v.string(),
      enabled: v.boolean(),
      status: v.union(v.literal("active"), v.literal("invalid")),
      lastError: v.optional(v.string()),
      createdAt: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    const user = await getAuthedUserOrNull(ctx);
    if (!user) return null;
    const project = await ctx.db.get(args.projectId);
    if (!project || project.userId !== user._id) return null;

    const target = await ctx.db
      .query("analytics_targets")
      .withIndex("by_projectId", (q) => q.eq("projectId", args.projectId))
      .unique();
    if (!target) return null;
    return {
      _id: target._id,
      provider: target.provider,
      mode: target.mode ?? "api",
      ...(target.shareUrl !== undefined ? { shareUrl: target.shareUrl } : {}),
      embedBlocked: target.embedBlocked === true,
      ...(target.baseUrl !== undefined ? { baseUrl: target.baseUrl } : {}),
      siteId: target.siteId,
      enabled: target.enabled === true,
      status: target.status,
      ...(target.lastError !== undefined
        ? { lastError: target.lastError }
        : {}),
      createdAt: target.createdAt,
    };
  },
});

/**
 * Share-link mode — the free-tier path: no token, no API; the provider's
 * public share page is shown on the Analytics panel. Connect probes the
 * URL: it must be reachable, and its response headers decide whether we
 * can iframe it (Umami Cloud forbids embedding via frame-ancestors — we
 * store that and render an open-in-new-tab panel instead of a dead frame).
 * Connecting also enables analytics — the user just walked the setup flow.
 */
export const connectShare = action({
  args: {
    projectId: v.id("projects"),
    provider: analyticsProviderValidator,
    shareUrl: v.string(),
  },
  returns: v.object({
    ok: v.boolean(),
    embeddable: v.optional(v.boolean()),
    message: v.optional(v.string()),
  }),
  handler: async (
    ctx,
    args,
  ): Promise<{ ok: boolean; embeddable?: boolean; message?: string }> => {
    const key = await getRateLimitKey(ctx);
    await rateLimiter.limit(ctx, "analytics:connect", { key, throws: true });

    const { user } = await loadOwnerContext(ctx, args.projectId);

    const shareUrl = args.shareUrl.trim();
    let parsed: URL;
    try {
      parsed = new URL(shareUrl);
    } catch {
      return { ok: false, message: "Enter a valid share URL." };
    }
    if (parsed.protocol !== "https:") {
      return { ok: false, message: "Share URL must use https://" };
    }
    if (!parsed.pathname.includes("/share/")) {
      return {
        ok: false,
        message:
          'That doesn\'t look like a share link — it should contain "/share/". In Umami: Settings → Websites → Edit → Share URL. In Plausible: Site settings → Visibility → Shared links.',
      };
    }

    let res: Response;
    try {
      res = await fetch(shareUrl, {
        redirect: "follow",
        signal: AbortSignal.timeout(10_000),
      });
    } catch {
      return {
        ok: false,
        message:
          "Could not reach that share URL — check it opens in a browser.",
      };
    }
    if (!res.ok) {
      return {
        ok: false,
        message: `The share URL returned ${res.status} — make sure the share link is enabled in your analytics dashboard.`,
      };
    }
    // Disabled/invalid share links redirect to the provider's homepage —
    // a 200 that silently isn't the dashboard. Catch it here, not as a
    // mysteriously blank embed.
    if (!new URL(res.url).pathname.includes("/share/")) {
      return {
        ok: false,
        message:
          "That link redirected away from the share page — the share link is probably disabled or the URL is wrong. Re-copy it from your analytics dashboard.",
      };
    }

    // Embeddability, per spec precedence: a frame-ancestors directive
    // overrides X-Frame-Options entirely (Umami Cloud sends BOTH — XFO
    // SAMEORIGIN plus frame-ancestors *, which browsers read as "allowed").
    // Only when no frame-ancestors exists does XFO decide.
    const xfo = res.headers.get("x-frame-options");
    const csp = res.headers.get("content-security-policy") ?? "";
    const frameAncestors = /frame-ancestors\s+([^;]+)/i.exec(csp)?.[1];
    const embedBlocked =
      frameAncestors !== undefined
        ? !frameAncestors.includes("*")
        : Boolean(xfo);

    await ctx.runMutation(internal.insights.targets._insertShare, {
      projectId: args.projectId,
      userId: user._id,
      provider: args.provider,
      shareUrl,
      embedBlocked,
    });
    return { ok: true, embeddable: !embedBlocked };
  },
});

/** Master switch — connecting alone never turns analytics on. */
export const setEnabled = mutation({
  args: { projectId: v.id("projects"), enabled: v.boolean() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    const project = await ctx.db.get(args.projectId);
    if (!project || project.userId !== user._id) {
      throw new ConvexError({ message: "Unauthorized" });
    }
    const target = await ctx.db
      .query("analytics_targets")
      .withIndex("by_projectId", (q) => q.eq("projectId", args.projectId))
      .unique();
    if (!target) {
      throw new ConvexError({
        message: "Connect an analytics provider first.",
      });
    }
    await ctx.db.patch(target._id, {
      enabled: args.enabled,
      updatedAt: Date.now(),
    });
    return null;
  },
});

export const connect = action({
  args: {
    projectId: v.id("projects"),
    provider: analyticsProviderValidator,
    token: v.string(),
    /** Self-hosted instance URL (https://stats.example.com); omit for cloud. */
    baseUrl: v.optional(v.string()),
    /**
     * Plausible: the site_id domain (defaults to the project siteUrl's
     * hostname). Umami resolves its websiteId from the hostname itself.
     */
    siteDomain: v.optional(v.string()),
  },
  returns: v.object({ ok: v.boolean(), message: v.optional(v.string()) }),
  handler: async (ctx, args): Promise<{ ok: boolean; message?: string }> => {
    const key = await getRateLimitKey(ctx);
    await rateLimiter.limit(ctx, "analytics:connect", { key, throws: true });
    await rateLimiter.limit(ctx, "vault:write", { key, throws: true });

    const { user, project } = await loadOwnerContext(ctx, args.projectId);

    const token = args.token.trim();
    if (!token) throw new ConvexError({ message: "API token is required." });
    if (token.length > 2048)
      throw new ConvexError({ message: "API token is too long." });

    const baseUrl = args.baseUrl?.trim() || undefined;
    if (baseUrl && !/^https?:\/\//.test(baseUrl)) {
      throw new ConvexError({
        message: "Instance URL must start with http(s)://",
      });
    }

    const hostname = args.siteDomain?.trim() || hostnameOf(project.siteUrl);
    if (!hostname) {
      throw new ConvexError({
        message:
          "Set your Site URL in General settings first (or enter the site domain) — it identifies the site in your analytics account.",
      });
    }

    // Validate before vaulting — fail fast with the provider's exact error.
    let siteId: string;
    if (args.provider === "plausible") {
      const check = await validatePlausible({
        token,
        baseUrl,
        siteId: hostname,
      });
      if (!check.ok) return { ok: false, message: check.message };
      siteId = hostname;
    } else {
      const resolved = await resolveUmamiWebsite({ token, baseUrl, hostname });
      if (!resolved.ok) return { ok: false, message: resolved.message };
      siteId = resolved.data.websiteId;
    }

    const created: { id: string } = await ctx.runAction(
      internal.integrations.secretStore._create,
      {
        value: token,
        meta: {
          userId: user._id,
          projectId: args.projectId,
          provider: args.provider,
          label: `${args.provider}-analytics-token`,
        },
      },
    );

    await ctx.runMutation(internal.insights.targets._replace, {
      projectId: args.projectId,
      userId: user._id,
      provider: args.provider,
      vaultSecretId: created.id,
      ...(baseUrl !== undefined ? { baseUrl } : {}),
      siteId,
    });
    return { ok: true };
  },
});

export const remove = mutation({
  args: { projectId: v.id("projects") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    const project = await ctx.db.get(args.projectId);
    if (!project || project.userId !== user._id) {
      throw new ConvexError({ message: "Unauthorized" });
    }
    const target = await ctx.db
      .query("analytics_targets")
      .withIndex("by_projectId", (q) => q.eq("projectId", args.projectId))
      .unique();
    if (!target) return null;

    // Best-effort vault cleanup; the row goes regardless. Share-mode rows
    // have no secret to clean.
    if (target.vaultSecretId) {
      await ctx.scheduler.runAfter(
        0,
        internal.integrations.secretStore._delete,
        { id: target.vaultSecretId },
      );
    }
    await ctx.db.delete(target._id);

    const snapshot = await ctx.db
      .query("analytics_snapshots")
      .withIndex("by_projectId", (q) => q.eq("projectId", args.projectId))
      .unique();
    if (snapshot) await ctx.db.delete(snapshot._id);
    return null;
  },
});

/* ------------------------------------------------------------------ */
/*  Internal                                                            */
/* ------------------------------------------------------------------ */

export const _getByProject = internalQuery({
  args: { projectId: v.id("projects") },
  returns: v.union(v.null(), TARGET_DOC),
  handler: async (ctx, args) => {
    return await ctx.db
      .query("analytics_targets")
      .withIndex("by_projectId", (q) => q.eq("projectId", args.projectId))
      .unique();
  },
});

/** Delete any existing connection row (+ schedule vault cleanup). */
async function clearExisting(
  ctx: { db: MutationCtx["db"]; scheduler: MutationCtx["scheduler"] },
  projectId: Id<"projects">,
): Promise<void> {
  const existing = await ctx.db
    .query("analytics_targets")
    .withIndex("by_projectId", (q) => q.eq("projectId", projectId))
    .unique();
  if (!existing) return;
  if (existing.vaultSecretId) {
    await ctx.scheduler.runAfter(0, internal.integrations.secretStore._delete, {
      id: existing.vaultSecretId,
    });
  }
  await ctx.db.delete(existing._id);
}

/**
 * Insert-or-replace the project's API-mode connection. Connecting enables
 * analytics — the user has already opted in by walking the setup flow.
 */
export const _replace = internalMutation({
  args: {
    projectId: v.id("projects"),
    userId: v.id("users"),
    provider: analyticsProviderValidator,
    vaultSecretId: v.string(),
    baseUrl: v.optional(v.string()),
    siteId: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await clearExisting(ctx, args.projectId);
    const now = Date.now();
    await ctx.db.insert("analytics_targets", {
      projectId: args.projectId,
      userId: args.userId,
      provider: args.provider,
      mode: "api" as const,
      vaultSecretId: args.vaultSecretId,
      ...(args.baseUrl !== undefined ? { baseUrl: args.baseUrl } : {}),
      siteId: args.siteId,
      enabled: true,
      status: "active" as const,
      createdAt: now,
      updatedAt: now,
    });
    return null;
  },
});

/** Insert-or-replace a share-mode connection (no secret). */
export const _insertShare = internalMutation({
  args: {
    projectId: v.id("projects"),
    userId: v.id("users"),
    provider: analyticsProviderValidator,
    shareUrl: v.string(),
    embedBlocked: v.boolean(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await clearExisting(ctx, args.projectId);
    const now = Date.now();
    await ctx.db.insert("analytics_targets", {
      projectId: args.projectId,
      userId: args.userId,
      provider: args.provider,
      mode: "share" as const,
      shareUrl: args.shareUrl,
      embedBlocked: args.embedBlocked,
      siteId: "",
      enabled: true,
      status: "active" as const,
      createdAt: now,
      updatedAt: now,
    });
    return null;
  },
});

export const _setStatus = internalMutation({
  args: {
    targetId: v.id("analytics_targets"),
    status: v.union(v.literal("active"), v.literal("invalid")),
    lastError: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.targetId, {
      status: args.status,
      lastError: args.lastError,
      updatedAt: Date.now(),
    });
    return null;
  },
});

/* ------------------------------------------------------------------ */
/*  Helpers                                                             */
/* ------------------------------------------------------------------ */

export function hostnameOf(siteUrl: string | undefined): string | null {
  if (!siteUrl) return null;
  try {
    return new URL(siteUrl).hostname;
  } catch {
    return null;
  }
}

export async function loadOwnerContext(
  ctx: ActionCtx,
  projectId: Id<"projects">,
): Promise<{
  user: { _id: Id<"users"> };
  project: { _id: Id<"projects">; siteUrl?: string };
}> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new ConvexError({ message: "Not authenticated" });
  const user = await ctx.runQuery(internal.account.users.internalGetByToken, {
    tokenIdentifier: identity.tokenIdentifier,
  });
  if (!user) throw new ConvexError({ message: "User not found" });
  const project = await ctx.runQuery(internal.cms.projects.internalGet, {
    projectId,
  });
  if (!project || project.userId !== user._id)
    throw new ConvexError({ message: "Unauthorized" });
  return {
    user: { _id: user._id },
    project: {
      _id: project._id,
      ...(project.siteUrl !== undefined ? { siteUrl: project.siteUrl } : {}),
    },
  };
}
