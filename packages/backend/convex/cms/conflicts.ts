import { v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import { internalMutation, mutation, query } from "../_generated/server";
import { getAuthedUserOrNull, getCurrentUser } from "../_lib/auth";
import type { DocPatch } from "../_lib/docPatch";
import { getRateLimitKey, rateLimiter } from "../_lib/rateLimits";
import { countWords } from "../_lib/wordCount";
import {
  buildExcerpt,
  readContent,
  writeContent,
} from "./_lib/documentContent";
import { syncDocumentLinks } from "./_lib/documentLinks";

export const _create = internalMutation({
  args: {
    projectId: v.id("projects"),
    documentId: v.id("documents"),
    userId: v.id("users"),
    githubPath: v.string(),
    remoteSha: v.string(),
    remoteContent: v.string(),
    remoteFrontmatter: v.optional(v.string()),
    localContentSnapshot: v.string(),
    localFrontmatterSnapshot: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<Id<"sync_conflicts">> => {
    const now = Date.now();

    const existing = await ctx.db
      .query("sync_conflicts")
      .withIndex("by_documentId_unresolved", (q) =>
        q.eq("documentId", args.documentId).eq("resolvedAt", undefined),
      )
      .take(10);
    const openConflict = existing[0];

    if (openConflict) {
      const patch: DocPatch<"sync_conflicts"> = {
        remoteSha: args.remoteSha,
        remoteContent: args.remoteContent,
        localContentSnapshot: args.localContentSnapshot,
        detectedAt: now,
      };
      if (args.remoteFrontmatter !== undefined) {
        patch.remoteFrontmatter = args.remoteFrontmatter;
      }
      if (args.localFrontmatterSnapshot !== undefined) {
        patch.localFrontmatterSnapshot = args.localFrontmatterSnapshot;
      }
      await ctx.db.patch(openConflict._id, patch);
      return openConflict._id;
    }

    const insertData: {
      projectId: Id<"projects">;
      documentId: Id<"documents">;
      userId: Id<"users">;
      githubPath: string;
      remoteSha: string;
      remoteContent: string;
      remoteFrontmatter?: string;
      localContentSnapshot: string;
      localFrontmatterSnapshot?: string;
      detectedAt: number;
    } = {
      projectId: args.projectId,
      documentId: args.documentId,
      userId: args.userId,
      githubPath: args.githubPath,
      remoteSha: args.remoteSha,
      remoteContent: args.remoteContent,
      localContentSnapshot: args.localContentSnapshot,
      detectedAt: now,
    };
    if (args.remoteFrontmatter !== undefined) {
      insertData.remoteFrontmatter = args.remoteFrontmatter;
    }
    if (args.localFrontmatterSnapshot !== undefined) {
      insertData.localFrontmatterSnapshot = args.localFrontmatterSnapshot;
    }
    return await ctx.db.insert("sync_conflicts", insertData);
  },
});

export const listForProject = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    const user = await getAuthedUserOrNull(ctx);
    if (!user) return [];

    const project = await ctx.db.get(args.projectId);
    if (!project || project.userId !== user._id) return [];

    const conflicts = await ctx.db
      .query("sync_conflicts")
      .withIndex("by_projectId_unresolved", (q) =>
        q.eq("projectId", args.projectId).eq("resolvedAt", undefined),
      )
      .take(100);

    return conflicts
      .sort((a, b) => b.detectedAt - a.detectedAt)
      .map((c) => ({
        _id: c._id,
        documentId: c.documentId,
        githubPath: c.githubPath,
        detectedAt: c.detectedAt,
      }));
  },
});

export const getOpenByDocument = query({
  args: { documentId: v.id("documents") },
  handler: async (ctx, args) => {
    const user = await getAuthedUserOrNull(ctx);
    if (!user) return null;

    const document = await ctx.db.get(args.documentId);
    if (!document) return null;
    const project = await ctx.db.get(document.projectId);
    if (!project || project.userId !== user._id) return null;

    const conflicts = await ctx.db
      .query("sync_conflicts")
      .withIndex("by_documentId_unresolved", (q) =>
        q.eq("documentId", args.documentId).eq("resolvedAt", undefined),
      )
      .take(10);
    const open = conflicts[0];
    if (!open) return null;
    return {
      _id: open._id,
      projectId: open.projectId,
      githubPath: open.githubPath,
      detectedAt: open.detectedAt,
    };
  },
});

export const get = query({
  args: { conflictId: v.id("sync_conflicts") },
  handler: async (ctx, args) => {
    const user = await getAuthedUserOrNull(ctx);
    if (!user) return null;

    const conflict = await ctx.db.get(args.conflictId);
    if (!conflict) return null;

    const project = await ctx.db.get(conflict.projectId);
    if (!project || project.userId !== user._id) return null;

    const document = await ctx.db.get(conflict.documentId);
    if (!document) return null;

    return {
      conflict,
      document: {
        _id: document._id,
        title: document.title,
        slug: document.slug,
        content: await readContent(ctx, document),
        frontmatter: document.frontmatter,
        githubSha: document.githubSha,
        githubSyncedAt: document.githubSyncedAt,
        updatedAt: document.updatedAt,
      },
    };
  },
});

async function loadOpenConflictForOwner(
  ctx: {
    auth: import("../_generated/server").MutationCtx["auth"];
    db: import("../_generated/server").MutationCtx["db"];
  },
  conflictId: Id<"sync_conflicts">,
): Promise<{ conflict: Doc<"sync_conflicts">; doc: Doc<"documents"> }> {
  const user = await getCurrentUser(ctx);
  const conflict = await ctx.db.get(conflictId);
  if (!conflict) throw new Error("Conflict not found");

  if (conflict.resolvedAt !== undefined) {
    throw new Error("Conflict already resolved");
  }

  const project = await ctx.db.get(conflict.projectId);
  if (!project) throw new Error("Project not found");
  if (project.userId !== user._id) {
    throw new Error("Unauthorized: you do not own this conflict");
  }

  const doc = await ctx.db.get(conflict.documentId);
  if (!doc) throw new Error("Document not found");

  return { conflict, doc };
}

export const resolveUseGithub = mutation({
  args: { conflictId: v.id("sync_conflicts") },
  handler: async (ctx, args) => {
    const key = await getRateLimitKey(ctx);
    await rateLimiter.limit(ctx, "conflicts:resolve", { key, throws: true });

    const { conflict, doc } = await loadOpenConflictForOwner(
      ctx,
      args.conflictId,
    );
    if (conflict.remoteContent === undefined) {
      throw new Error("Conflict is missing its remote content snapshot");
    }
    const remoteContent = conflict.remoteContent;
    const now = Date.now();

    const contentId = await writeContent(ctx, {
      documentId: conflict.documentId,
      projectId: doc.projectId,
      userId: doc.userId,
      content: remoteContent,
      ...(doc.contentId ? { contentId: doc.contentId } : {}),
    });

    const patch: DocPatch<"documents"> = {
      excerpt: buildExcerpt(remoteContent),
      wordCount: countWords(remoteContent),
      githubSha: conflict.remoteSha,
      githubSyncedAt: now,
      updatedAt: now,
    };
    if (conflict.remoteFrontmatter !== undefined) {
      patch.frontmatter = conflict.remoteFrontmatter;
    }
    if (doc.contentId === undefined) {
      patch.contentId = contentId;
    }

    await ctx.db.patch(conflict.documentId, patch);

    await syncDocumentLinks(ctx, doc, remoteContent);

    await ctx.db.patch(conflict._id, {
      resolvedAt: now,
      resolution: "github" as const,
      remoteContent: undefined,
      localContentSnapshot: undefined,
      remoteFrontmatter: undefined,
      localFrontmatterSnapshot: undefined,
    });
  },
});

export const resolveKeepConvex = mutation({
  args: { conflictId: v.id("sync_conflicts") },
  handler: async (ctx, args) => {
    const key = await getRateLimitKey(ctx);
    await rateLimiter.limit(ctx, "conflicts:resolve", { key, throws: true });

    const { conflict } = await loadOpenConflictForOwner(ctx, args.conflictId);
    const now = Date.now();

    await ctx.db.patch(conflict.documentId, {
      githubSha: conflict.remoteSha,
      githubSyncedAt: now,
      updatedAt: now,
    });
    await ctx.db.patch(conflict._id, {
      resolvedAt: now,
      resolution: "convex" as const,
      remoteContent: undefined,
      localContentSnapshot: undefined,
      remoteFrontmatter: undefined,
      localFrontmatterSnapshot: undefined,
    });
  },
});

export const resolveMerge = mutation({
  args: {
    conflictId: v.id("sync_conflicts"),
    mergedContent: v.string(),
    mergedFrontmatter: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const key = await getRateLimitKey(ctx);
    await rateLimiter.limit(ctx, "conflicts:resolve", { key, throws: true });

    const { conflict, doc } = await loadOpenConflictForOwner(
      ctx,
      args.conflictId,
    );
    const now = Date.now();

    const contentId = await writeContent(ctx, {
      documentId: conflict.documentId,
      projectId: doc.projectId,
      userId: doc.userId,
      content: args.mergedContent,
      ...(doc.contentId ? { contentId: doc.contentId } : {}),
    });

    const patch: DocPatch<"documents"> = {
      excerpt: buildExcerpt(args.mergedContent),
      wordCount: countWords(args.mergedContent),
      githubSha: conflict.remoteSha,
      githubSyncedAt: now,
      updatedAt: now,
    };
    if (args.mergedFrontmatter !== undefined) {
      patch.frontmatter = args.mergedFrontmatter;
    }
    if (doc.contentId === undefined) {
      patch.contentId = contentId;
    }

    await ctx.db.patch(conflict.documentId, patch);

    await syncDocumentLinks(ctx, doc, args.mergedContent);

    await ctx.db.patch(conflict._id, {
      resolvedAt: now,
      resolution: "merge" as const,
      remoteContent: undefined,
      localContentSnapshot: undefined,
      remoteFrontmatter: undefined,
      localFrontmatterSnapshot: undefined,
    });
  },
});
