/**
 * Shareable draft-preview links: a tokenized, read-only public view of a
 * document's live content at `{app-url}/preview/{token}`.
 *
 * The token is the whole secret — generated client-side with the Web
 * Crypto UUID (the server only validates its shape) and revocable at any
 * time. One active link per document; `create` is idempotent and returns
 * the existing active link when one exists.
 */
import { v } from "convex/values";
import { mutation, query } from "../_generated/server";
import { getAuthedUserOrNull, getCurrentUser } from "../_lib/auth";
import { getRateLimitKey, rateLimiter } from "../_lib/rateLimits";

/** Client-generated token: long, URL-safe, no exotic characters. */
const TOKEN_RE = /^[a-zA-Z0-9-]{20,64}$/;

/**
 * PUBLIC — resolves a preview token to the document's current content.
 * No auth on purpose: the token is the credential. Returns null for
 * unknown, revoked, or trashed targets without distinguishing which.
 */
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

    return {
      title: document.title,
      content: document.content,
      updatedAt: document.updatedAt,
    };
  },
});

/** The document's active share link (owner only), or null. */
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

    // Idempotent: reuse the active link instead of minting another.
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
