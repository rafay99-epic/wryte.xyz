/**
 * Newsletter provider connection lifecycle — connect / test / disconnect,
 * plus the settings query. Modeled on `syndication/credentials.ts`
 * (validate-then-vault). Brevo connects by API key; Mailchimp OAuth is
 * declared in the registry but not wired here yet.
 */

import { ConvexError, v } from "convex/values";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import type { ActionCtx } from "../_generated/server";
import {
  action,
  internalMutation,
  internalQuery,
  query,
} from "../_generated/server";
import { getAuthedUserOrNull } from "../_lib/auth";
import { getRateLimitKey, rateLimiter } from "../_lib/rateLimits";
import { newsletterProviderValidator, parseLists } from "./_lib/providers";
import { fetchBrevoLists, fetchBrevoSenders, validateBrevo } from "./brevo";

const CONNECTION_DOC = v.object({
  _id: v.id("newsletterConnections"),
  _creationTime: v.number(),
  projectId: v.id("projects"),
  userId: v.id("users"),
  provider: newsletterProviderValidator,
  mode: v.union(v.literal("apikey"), v.literal("oauth")),
  vaultSecretId: v.string(),
  dc: v.optional(v.string()),
  senderEmail: v.optional(v.string()),
  senderName: v.optional(v.string()),
  lists: v.optional(v.string()),
  status: v.union(v.literal("active"), v.literal("invalid")),
  lastError: v.optional(v.string()),
  createdAt: v.number(),
  updatedAt: v.number(),
});

/** Settings view — provider, sender, cached lists; never the secret. */
export const get = query({
  args: { projectId: v.id("projects") },
  returns: v.union(
    v.null(),
    v.object({
      provider: newsletterProviderValidator,
      senderEmail: v.optional(v.string()),
      senderName: v.optional(v.string()),
      lists: v.array(v.object({ id: v.string(), name: v.string() })),
      status: v.union(v.literal("active"), v.literal("invalid")),
      lastError: v.optional(v.string()),
    }),
  ),
  handler: async (ctx, args) => {
    const user = await getAuthedUserOrNull(ctx);
    if (!user) return null;
    const project = await ctx.db.get(args.projectId);
    if (!project || project.userId !== user._id) return null;

    const conn = await ctx.db
      .query("newsletterConnections")
      .withIndex("by_projectId", (q) => q.eq("projectId", args.projectId))
      .unique();
    if (!conn) return null;
    return {
      provider: conn.provider,
      ...(conn.senderEmail !== undefined
        ? { senderEmail: conn.senderEmail }
        : {}),
      ...(conn.senderName !== undefined ? { senderName: conn.senderName } : {}),
      lists: parseLists(conn.lists),
      status: conn.status,
      ...(conn.lastError !== undefined ? { lastError: conn.lastError } : {}),
    };
  },
});

export const connect = action({
  args: {
    projectId: v.id("projects"),
    provider: newsletterProviderValidator,
    apiKey: v.string(),
  },
  returns: v.object({ ok: v.boolean(), message: v.optional(v.string()) }),
  handler: async (ctx, args): Promise<{ ok: boolean; message?: string }> => {
    const key = await getRateLimitKey(ctx);
    await rateLimiter.limit(ctx, "newsletter:connect", { key, throws: true });
    await rateLimiter.limit(ctx, "vault:write", { key, throws: true });

    const { user } = await loadOwner(ctx, args.projectId);

    if (args.provider !== "brevo") {
      return {
        ok: false,
        message: "Mailchimp connect is coming soon — use Brevo for now.",
      };
    }

    const apiKey = args.apiKey.trim();
    if (!apiKey) throw new ConvexError({ message: "API key is required." });
    if (apiKey.length > 512)
      throw new ConvexError({ message: "API key is too long." });

    const valid = await validateBrevo(apiKey);
    if (!valid.ok) return { ok: false, message: valid.message };

    // Brevo won't send from an unverified sender — surface it now.
    const senders = await fetchBrevoSenders(apiKey);
    if (!senders.ok) return { ok: false, message: senders.message };
    const active = senders.data.find((s) => s.active) ?? senders.data[0];
    if (!active) {
      return {
        ok: false,
        message:
          "No sender found in Brevo — add and verify a sender in Brevo → Senders, then reconnect.",
      };
    }

    const lists = await fetchBrevoLists(apiKey);
    if (!lists.ok) return { ok: false, message: lists.message };

    const created: { id: string } = await ctx.runAction(
      internal.integrations.secretStore._create,
      {
        value: apiKey,
        meta: {
          userId: user._id,
          projectId: args.projectId,
          provider: "brevo",
          label: "brevo-newsletter-key",
        },
      },
    );

    await ctx.runMutation(internal.newsletter.connections._upsert, {
      projectId: args.projectId,
      userId: user._id,
      provider: "brevo",
      mode: "apikey",
      vaultSecretId: created.id,
      senderEmail: active.email,
      senderName: active.name,
      lists: JSON.stringify(lists.data),
    });
    return { ok: true };
  },
});

/** Re-verify + refresh cached senders/lists. */
export const test = action({
  args: { projectId: v.id("projects") },
  returns: v.object({ ok: v.boolean(), message: v.optional(v.string()) }),
  handler: async (ctx, args): Promise<{ ok: boolean; message?: string }> => {
    const key = await getRateLimitKey(ctx);
    await rateLimiter.limit(ctx, "newsletter:connect", { key, throws: true });

    const conn = await loadOwnedConnection(ctx, args.projectId);
    await rateLimiter.limit(ctx, "vault:read", { key, throws: true });
    const apiKey: string = await ctx.runAction(
      internal.integrations.secretStore._read,
      { id: conn.vaultSecretId },
    );

    const valid = await validateBrevo(apiKey);
    if (!valid.ok) {
      await ctx.runMutation(internal.newsletter.connections._setStatus, {
        connectionId: conn._id,
        status: "invalid",
        lastError: valid.message,
      });
      return { ok: false, message: valid.message };
    }

    const lists = await fetchBrevoLists(apiKey);
    const senders = await fetchBrevoSenders(apiKey);
    await ctx.runMutation(internal.newsletter.connections._refresh, {
      connectionId: conn._id,
      ...(lists.ok ? { lists: JSON.stringify(lists.data) } : {}),
      ...(senders.ok
        ? (() => {
            const active =
              senders.data.find((s) => s.active) ?? senders.data[0];
            return active
              ? { senderEmail: active.email, senderName: active.name }
              : {};
          })()
        : {}),
    });
    return { ok: true };
  },
});

export const disconnect = action({
  args: { projectId: v.id("projects") },
  returns: v.null(),
  handler: async (ctx, args): Promise<null> => {
    const key = await getRateLimitKey(ctx);
    await rateLimiter.limit(ctx, "newsletter:connect", { key, throws: true });

    await loadOwner(ctx, args.projectId);
    const conn = await ctx.runQuery(
      internal.newsletter.connections._findByProject,
      { projectId: args.projectId },
    );
    if (!conn) return null;
    try {
      await ctx.runAction(internal.integrations.secretStore._delete, {
        id: conn.vaultSecretId,
      });
    } catch {
      // Best-effort.
    }
    await ctx.runMutation(internal.newsletter.connections._delete, {
      connectionId: conn._id,
    });
    return null;
  },
});

/* ------------------------------------------------------------------ */
/*  Internal                                                            */
/* ------------------------------------------------------------------ */

export const _findByProject = internalQuery({
  args: { projectId: v.id("projects") },
  returns: v.union(v.null(), CONNECTION_DOC),
  handler: async (ctx, args) => {
    return await ctx.db
      .query("newsletterConnections")
      .withIndex("by_projectId", (q) => q.eq("projectId", args.projectId))
      .unique();
  },
});

export const _upsert = internalMutation({
  args: {
    projectId: v.id("projects"),
    userId: v.id("users"),
    provider: newsletterProviderValidator,
    mode: v.union(v.literal("apikey"), v.literal("oauth")),
    vaultSecretId: v.string(),
    dc: v.optional(v.string()),
    senderEmail: v.optional(v.string()),
    senderName: v.optional(v.string()),
    lists: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const now = Date.now();
    const existing = await ctx.db
      .query("newsletterConnections")
      .withIndex("by_projectId", (q) => q.eq("projectId", args.projectId))
      .unique();
    if (existing) {
      await ctx.scheduler.runAfter(
        0,
        internal.integrations.secretStore._delete,
        { id: existing.vaultSecretId },
      );
      await ctx.db.delete(existing._id);
    }
    await ctx.db.insert("newsletterConnections", {
      projectId: args.projectId,
      userId: args.userId,
      provider: args.provider,
      mode: args.mode,
      vaultSecretId: args.vaultSecretId,
      ...(args.dc !== undefined ? { dc: args.dc } : {}),
      ...(args.senderEmail !== undefined
        ? { senderEmail: args.senderEmail }
        : {}),
      ...(args.senderName !== undefined ? { senderName: args.senderName } : {}),
      ...(args.lists !== undefined ? { lists: args.lists } : {}),
      status: "active" as const,
      createdAt: now,
      updatedAt: now,
    });
    return null;
  },
});

export const _refresh = internalMutation({
  args: {
    connectionId: v.id("newsletterConnections"),
    lists: v.optional(v.string()),
    senderEmail: v.optional(v.string()),
    senderName: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const patch: Record<string, unknown> = {
      status: "active",
      lastError: undefined,
      updatedAt: Date.now(),
    };
    if (args.lists !== undefined) patch["lists"] = args.lists;
    if (args.senderEmail !== undefined) patch["senderEmail"] = args.senderEmail;
    if (args.senderName !== undefined) patch["senderName"] = args.senderName;
    await ctx.db.patch(args.connectionId, patch);
    return null;
  },
});

export const _setStatus = internalMutation({
  args: {
    connectionId: v.id("newsletterConnections"),
    status: v.union(v.literal("active"), v.literal("invalid")),
    lastError: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.connectionId, {
      status: args.status,
      lastError: args.lastError,
      updatedAt: Date.now(),
    });
    return null;
  },
});

export const _delete = internalMutation({
  args: { connectionId: v.id("newsletterConnections") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.delete(args.connectionId);
    return null;
  },
});

/* ------------------------------------------------------------------ */
/*  Helpers                                                             */
/* ------------------------------------------------------------------ */

export async function loadOwner(
  ctx: ActionCtx,
  projectId: Id<"projects">,
): Promise<{ user: { _id: Id<"users"> } }> {
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
  return { user: { _id: user._id } };
}

async function loadOwnedConnection(
  ctx: ActionCtx,
  projectId: Id<"projects">,
): Promise<{ _id: Id<"newsletterConnections">; vaultSecretId: string }> {
  await loadOwner(ctx, projectId);
  const conn = await ctx.runQuery(
    internal.newsletter.connections._findByProject,
    { projectId },
  );
  if (!conn) throw new ConvexError({ message: "No newsletter connected." });
  return { _id: conn._id, vaultSecretId: conn.vaultSecretId };
}
