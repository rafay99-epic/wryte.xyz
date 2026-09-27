import { v } from "convex/values";
import { mutation, query } from "../_generated/server";
import { getAuthedUserOrNull, getCurrentUser } from "../_lib/auth";
import { getRateLimitKey, rateLimiter } from "../_lib/rateLimits";
import { readContent } from "./_lib/documentContent";

const TOKEN_RE = /^[a-zA-Z0-9-]{20,64}$/;

export const getByToken = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    if (!TOKEN_RE.test(args.token)) return null;

    const link = await ctx.db
      .query("share_links")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .unique();
    if (!link || link.revokedAt !== undefined) return null;

    const document = await ctx.db.get(link.documentId);
    if (!document || document.trashedAt !== undefined) return null;

    const project = await ctx.db.get(document.projectId);

    return {
      title: document.title,
      content: await readContent(ctx, document),
      updatedAt: document.updatedAt,
      contentFormat: project?.contentFormat ?? "md",
    };
  },
});

export const animationsByToken = query({
  args: { token: v.string() },
  handler: async (ctx, args): Promise<{ name: string; source: string }[]> => {
    if (!TOKEN_RE.test(args.token)) return [];

    const link = await ctx.db
      .query("share_links")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .unique();
    if (!link || link.revokedAt !== undefined) return [];

    const document = await ctx.db.get(link.documentId);
    if (!document || document.trashedAt !== undefined) return [];

    const project = await ctx.db.get(document.projectId);
    const animationsOn =
      project?.contentFormat === "mdx" &&
      (project.animationsEnabled ?? !!project.animationsPath);
    if (!project || !animationsOn) return [];

    const rows = await ctx.db
      .query("animations")
      .withIndex("by_project", (q) => q.eq("projectId", project._id))
      .take(200);
    return rows.map((d) => ({ name: d.name, source: d.source }));
  },
});

export const getForDocument = query({
  args: { documentId: v.id("documents") },
  handler: async (ctx, args) => {
    const user = await getAuthedUserOrNull(ctx);
    if (!user) return null;

    const links = await ctx.db
      .query("share_links")
      .withIndex("by_documentId", (q) => q.eq("documentId", args.documentId))
      .take(10);
    const active = links.find(
      (link) => link.userId === user._id && link.revokedAt === undefined,
    );
    return active
      ? { _id: active._id, token: active.token, createdAt: active.createdAt }
      : null;
  },
});

export const create = mutation({
  args: {
    documentId: v.id("documents"),
    token: v.string(),
  },
  handler: async (ctx, args): Promise<{ token: string }> => {
    const key = await getRateLimitKey(ctx);
    await rateLimiter.limit(ctx, "shareLinks:create", { key, throws: true });

    if (!TOKEN_RE.test(args.token)) {
      throw new Error("Invalid share token format");
    }

    const user = await getCurrentUser(ctx);
    const document = await ctx.db.get(args.documentId);
    if (!document || document.trashedAt !== undefined) {
      throw new Error("Document not found");
    }
    const project = await ctx.db.get(document.projectId);
    if (!project || project.userId !== user._id) {
      throw new Error("Unauthorized: you do not own this document");
    }

    const links = await ctx.db
      .query("share_links")
      .withIndex("by_documentId", (q) => q.eq("documentId", args.documentId))
      .take(10);
    const active = links.find((link) => link.revokedAt === undefined);
    if (active) return { token: active.token };

    await ctx.db.insert("share_links", {
      documentId: args.documentId,
      projectId: document.projectId,
      userId: user._id,
      token: args.token,
      createdAt: Date.now(),
    });
    return { token: args.token };
  },
});

export const revoke = mutation({
  args: { documentId: v.id("documents") },
  handler: async (ctx, args) => {
    const key = await getRateLimitKey(ctx);
    await rateLimiter.limit(ctx, "shareLinks:revoke", { key, throws: true });

    const user = await getCurrentUser(ctx);
    const links = await ctx.db
      .query("share_links")
      .withIndex("by_documentId", (q) => q.eq("documentId", args.documentId))
      .take(10);

    const now = Date.now();
    for (const link of links) {
      if (link.userId === user._id && link.revokedAt === undefined) {
        await ctx.db.patch(link._id, { revokedAt: now });
      }
    }
  },
});

export const listForProject = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    const user = await getAuthedUserOrNull(ctx);
    if (!user) return [];

    const project = await ctx.db.get(args.projectId);
    if (!project || project.userId !== user._id) return [];

    const links = await ctx.db
      .query("share_links")
      .withIndex("by_projectId", (q) => q.eq("projectId", args.projectId))
      .take(200);

    const rows = await Promise.all(
      links
        .filter((link) => link.userId === user._id)
        .map(async (link) => {
          const document = await ctx.db.get(link.documentId);
          if (!document) return null;
          return {
            _id: link._id,
            documentId: link.documentId,
            token: link.token,
            createdAt: link.createdAt,
            revokedAt: link.revokedAt,
            title: document.title,
            trashed: document.trashedAt !== undefined,
          };
        }),
    );

    return rows
      .filter((row): row is NonNullable<typeof row> => row !== null)
      .sort((a, b) => b.createdAt - a.createdAt);
  },
});

export const revokeById = mutation({
  args: { linkId: v.id("share_links") },
  handler: async (ctx, args) => {
    const key = await getRateLimitKey(ctx);
    await rateLimiter.limit(ctx, "shareLinks:revoke", { key, throws: true });

    const user = await getCurrentUser(ctx);
    const link = await ctx.db.get(args.linkId);
    if (!link || link.userId !== user._id) {
      throw new Error("Share link not found");
    }
    if (link.revokedAt === undefined) {
      await ctx.db.patch(args.linkId, { revokedAt: Date.now() });
    }
  },
});

export const remove = mutation({
  args: { linkId: v.id("share_links") },
  handler: async (ctx, args) => {
    const key = await getRateLimitKey(ctx);
    await rateLimiter.limit(ctx, "shareLinks:revoke", { key, throws: true });

    const user = await getCurrentUser(ctx);
    const link = await ctx.db.get(args.linkId);
    if (!link || link.userId !== user._id) {
      throw new Error("Share link not found");
    }
    await ctx.db.delete(args.linkId);
  },
});
