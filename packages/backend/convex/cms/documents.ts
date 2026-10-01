import { vOnCompleteArgs } from "@convex-dev/workpool";
import { paginationOptsValidator } from "convex/server";
import { type ObjectType, v } from "convex/values";
import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import type {
  DatabaseReader,
  MutationCtx,
  QueryCtx,
} from "../_generated/server";
import {
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "../_generated/server";
import { getAuthedUserOrNull, getCurrentUser } from "../_lib/auth";
import type { DocPatch } from "../_lib/docPatch";
import { adjustDocumentCount } from "../_lib/documentCount";
import {
  scheduleStatusChange,
  scheduleWordActivity,
} from "../_lib/projectStats";
import { getRateLimitKey, rateLimiter } from "../_lib/rateLimits";
import { shouldTouch } from "../_lib/touch";
import { countWords } from "../_lib/wordCount";
import {
  buildExcerpt,
  CONTENT_SEARCH_LIMIT,
  extractSnippet,
  loadContentRow,
  MIN_CONTENT_TERM,
  readContent,
  readContentById,
  writeContent,
  writeEditorContent,
} from "./_lib/documentContent";
import { syncDocumentLinks } from "./_lib/documentLinks";

const documentFields = {
  _id: v.id("documents"),
  _creationTime: v.number(),
  projectId: v.id("projects"),
  userId: v.id("users"),
  title: v.string(),
  slug: v.string(),
  excerpt: v.optional(v.string()),
  contentId: v.optional(v.id("document_content")),
  wordCount: v.optional(v.number()),
  frontmatter: v.optional(v.string()),
  status: v.string(),
  tags: v.optional(v.array(v.string())),
  boardPosition: v.optional(v.number()),
  scheduledAt: v.optional(v.number()),
  publishedAt: v.optional(v.number()),
  bookmarked: v.optional(v.boolean()),
  githubPath: v.optional(v.string()),
  githubSha: v.optional(v.string()),
  githubSyncedAt: v.optional(v.number()),
  trashedAt: v.optional(v.number()),
  contentRev: v.optional(v.number()),
  contentWriter: v.optional(v.string()),
  createdAt: v.number(),
  updatedAt: v.number(),
};

const DOCUMENT_DOC = v.object(documentFields);

const DOCUMENT_DOC_WITH_CONTENT = v.object({
  ...documentFields,
  content: v.string(),
});

async function verifyDocumentOwnership(
  ctx: { db: DatabaseReader },
  documentId: Id<"documents">,
  userId: Id<"users">,
): Promise<Doc<"documents">> {
  const document = await ctx.db.get(documentId);
  if (!document) {
    throw new Error("Document not found");
  }

  const project = await ctx.db.get(document.projectId);
  if (!project) {
    throw new Error("Project not found");
  }

  if (project.userId !== userId) {
    throw new Error("Unauthorized: you do not own this document");
  }

  return document;
}

export const list = query({
  args: {
    projectId: v.id("projects"),
    status: v.optional(v.string()),
  },
  returns: v.array(
    v.object({
      ...documentFields,
      wordCount: v.number(),
      excerpt: v.string(),
    }),
  ),
  handler: async (ctx, args) => {
    const user = await getAuthedUserOrNull(ctx);
    if (!user) return [];

    const project = await ctx.db.get(args.projectId);
    if (!project || project.userId !== user._id) {
      return [];
    }

    let documents: Doc<"documents">[];
    if (args.status) {
      const status = args.status;
      const raw = await ctx.db
        .query("documents")
        .withIndex("by_projectId_and_status", (q) =>
          q.eq("projectId", args.projectId).eq("status", status),
        )
        .order("desc")
        .take(2000);
      documents = raw.filter((d) => d.trashedAt === undefined);
    } else {
      documents = await ctx.db
        .query("documents")
        .withIndex("by_projectId_and_trashedAt", (q) =>
          q.eq("projectId", args.projectId).eq("trashedAt", undefined),
        )
        .order("desc")
        .take(500);
    }

    return documents
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .map((d) => ({
        ...d,
        wordCount: d.wordCount ?? 0,
        excerpt: d.excerpt ?? "",
      }));
  },
});

export const listForLink = query({
  args: {
    projectId: v.id("projects"),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const user = await getAuthedUserOrNull(ctx);
    if (!user) return { page: [], isDone: true, continueCursor: "" };
    return await documentsPageForUser(
      ctx,
      user._id,
      args.projectId,
      args.paginationOpts,
    );
  },
});

export const searchForLink = query({
  args: {
    projectId: v.id("projects"),
    term: v.string(),
  },
  returns: v.array(
    v.object({
      _id: v.id("documents"),
      title: v.string(),
      slug: v.string(),
    }),
  ),
  handler: async (ctx, args) => {
    const user = await getAuthedUserOrNull(ctx);
    if (!user) return [];

    const project = await ctx.db.get(args.projectId);
    if (!project || project.userId !== user._id) return [];

    const term = args.term.trim();
    if (!term) return [];

    const docs = await ctx.db
      .query("documents")
      .withSearchIndex("search_title", (q) =>
        q.search("title", term).eq("projectId", args.projectId),
      )
      .take(10);

    return docs
      .filter((doc) => doc.trashedAt === undefined)
      .map((doc) => ({ _id: doc._id, title: doc.title, slug: doc.slug }));
  },
});

export async function searchDocumentsForUser(
  ctx: QueryCtx,
  userId: Id<"users">,
  args: { term: string; projectId?: Id<"projects">; limit?: number },
) {
  const empty = { results: [] };
  const term = args.term.trim();
  if (!term) return empty;

  const limit = Math.min(Math.max(args.limit ?? 20, 1), 50);

  if (args.projectId) {
    const project = await ctx.db.get(args.projectId);
    if (!project || project.userId !== userId) return empty;
  }

  const matches = (
    await ctx.db
      .query("documents")
      .withSearchIndex("search_title", (q) =>
        args.projectId
          ? q.search("title", term).eq("projectId", args.projectId)
          : q.search("title", term).eq("userId", userId),
      )
      .take(limit)
  ).filter((doc) => doc.trashedAt === undefined);

  const names = new Map<Id<"projects">, string>();
  for (const doc of matches) {
    if (names.has(doc.projectId)) continue;
    const project = await ctx.db.get(doc.projectId);
    names.set(doc.projectId, project?.name ?? "");
  }

  return {
    results: matches.map((doc) => ({
      _id: doc._id,
      projectId: doc.projectId,
      projectName: names.get(doc.projectId) ?? "",
      title: doc.title,
      slug: doc.slug,
      status: doc.status,
      updatedAt: doc.updatedAt,
      ...(doc.wordCount !== undefined ? { wordCount: doc.wordCount } : {}),
    })),
  };
}

export const searchContent = query({
  args: {
    term: v.string(),
    projectId: v.optional(v.id("projects")),
  },
  returns: v.array(
    v.object({
      documentId: v.id("documents"),
      projectId: v.id("projects"),
      title: v.string(),
      status: v.string(),
      snippet: v.string(),
      updatedAt: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    const user = await getAuthedUserOrNull(ctx);
    if (!user) return [];

    const term = args.term.trim();
    if (term.length < MIN_CONTENT_TERM) return [];

    if (args.projectId) {
      const project = await ctx.db.get(args.projectId);
      if (!project || project.userId !== user._id) return [];
    }

    const rows = await ctx.db
      .query("document_content")
      .withSearchIndex("search_content", (q) =>
        args.projectId
          ? q
              .search("content", term)
              .eq("userId", user._id)
              .eq("projectId", args.projectId)
          : q.search("content", term).eq("userId", user._id),
      )
      .take(CONTENT_SEARCH_LIMIT);

    const hits = [];
    for (const row of rows) {
      const doc = await ctx.db.get(row.documentId);
      if (!doc || doc.trashedAt !== undefined) continue;
      hits.push({
        documentId: doc._id,
        projectId: doc.projectId,
        title: doc.title || "Untitled",
        status: doc.status,
        snippet: extractSnippet(row.content, term),
        updatedAt: doc.updatedAt,
      });
    }

    return hits;
  },
});

export const listForExport = query({
  args: {
    projectId: v.id("projects"),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const empty = { page: [], isDone: true, continueCursor: "" };
    const user = await getAuthedUserOrNull(ctx);
    if (!user) return empty;

    const project = await ctx.db.get(args.projectId);
    if (!project || project.userId !== user._id) return empty;

    const result = await ctx.db
      .query("documents")
      .withIndex("by_projectId_and_trashedAt", (q) =>
        q.eq("projectId", args.projectId).eq("trashedAt", undefined),
      )
      .paginate(args.paginationOpts);

    return {
      ...result,
      page: await Promise.all(
        result.page.map(async (doc) => ({
          _id: doc._id,
          title: doc.title,
          slug: doc.slug,
          status: doc.status,
          content: await readContent(ctx, doc),
          frontmatter: doc.frontmatter ?? null,
          updatedAt: doc.updatedAt,
        })),
      ),
    };
  },
});

export const _listForLinkCheck = internalQuery({
  args: {
    tokenIdentifier: v.string(),
    projectId: v.id("projects"),
  },
  returns: v.union(
    v.null(),
    v.array(
      v.object({
        _id: v.id("documents"),
        title: v.string(),
        content: v.string(),
      }),
    ),
  ),
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_tokenIdentifier", (q) =>
        q.eq("tokenIdentifier", args.tokenIdentifier),
      )
      .unique();
    if (!user) return null;
    const project = await ctx.db.get(args.projectId);
    if (!project || project.userId !== user._id) return null;

    const docs = await ctx.db
      .query("documents")
      .withIndex("by_projectId_and_trashedAt", (q) =>
        q.eq("projectId", args.projectId).eq("trashedAt", undefined),
      )
      .take(500);
    return await Promise.all(
      docs.map(async (doc) => ({
        _id: doc._id,
        title: doc.title,
        content: await readContent(ctx, doc),
      })),
    );
  },
});

export const listRecent = query({
  args: {
    limit: v.optional(v.number()),
    projectId: v.optional(v.id("projects")),
  },
  returns: v.array(
    v.object({
      _id: v.id("documents"),
      title: v.string(),
      status: v.string(),
      projectId: v.id("projects"),
      updatedAt: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    const user = await getAuthedUserOrNull(ctx);
    if (!user) return [];

    const limit = args.limit ?? 5;
    const pid = args.projectId;

    if (pid) {
      const project = await ctx.db.get(pid);
      if (!project || project.userId !== user._id) return [];
    }

    const documents = pid
      ? await ctx.db
          .query("documents")
          .withIndex("by_projectId_and_trashedAt", (q) =>
            q.eq("projectId", pid).eq("trashedAt", undefined),
          )
          .order("desc")
          .take(200)
      : await ctx.db
          .query("documents")
          .withIndex("by_userId", (q) => q.eq("userId", user._id))
          .order("desc")
          .take(200);

    return documents
      .filter((d) => d.trashedAt === undefined)
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, limit)
      .map((d) => ({
        _id: d._id,
        title: d.title,
        status: d.status,
        projectId: d.projectId,
        updatedAt: d.updatedAt,
      }));
  },
});

export const listPalette = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("documents"),
      title: v.string(),
      slug: v.string(),
      status: v.string(),
      tags: v.optional(v.array(v.string())),
      projectId: v.id("projects"),
      updatedAt: v.number(),
    }),
  ),
  handler: async (ctx) => {
    const user = await getAuthedUserOrNull(ctx);
    if (!user) return [];

    const documents = await ctx.db
      .query("documents")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .order("desc")
      .take(1000);

    return documents
      .filter((d) => d.trashedAt === undefined)
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .map((d) => ({
        _id: d._id,
        title: d.title,
        slug: d.slug,
        status: d.status,
        ...(d.tags ? { tags: d.tags } : {}),
        projectId: d.projectId,
        updatedAt: d.updatedAt,
      }));
  },
});

export const get = query({
  args: { documentId: v.id("documents") },
  returns: v.union(v.null(), DOCUMENT_DOC_WITH_CONTENT),
  handler: async (ctx, args) => {
    const user = await getAuthedUserOrNull(ctx);
    if (!user) {
      throw new Error("Not authenticated");
    }
    return await documentWithContentForUser(ctx, user._id, args.documentId);
  },
});

export async function documentForUser(
  ctx: QueryCtx,
  userId: Id<"users">,
  documentId: Id<"documents">,
): Promise<Doc<"documents"> | null> {
  const document = await verifyDocumentOwnership(ctx, documentId, userId);
  return document.trashedAt === undefined ? document : null;
}

export async function documentWithContentForUser(
  ctx: QueryCtx,
  userId: Id<"users">,
  documentId: Id<"documents">,
) {
  const document = await verifyDocumentOwnership(ctx, documentId, userId);
  if (document.trashedAt !== undefined) return null;
  const content = await readContent(ctx, document);
  return { ...document, content };
}

export async function documentsPageForUser(
  ctx: QueryCtx,
  userId: Id<"users">,
  projectId: Id<"projects">,
  paginationOpts: { numItems: number; cursor: string | null },
) {
  const empty = { page: [], isDone: true, continueCursor: "" };
  const project = await ctx.db.get(projectId);
  if (!project || project.userId !== userId) return empty;

  const result = await ctx.db
    .query("documents")
    .withIndex("by_projectId_and_trashedAt", (q) =>
      q.eq("projectId", projectId).eq("trashedAt", undefined),
    )
    .order("desc")
    .paginate(paginationOpts);

  return {
    ...result,
    page: result.page.map((doc) => ({
      _id: doc._id,
      title: doc.title,
      slug: doc.slug,
    })),
  };
}

export const getMeta = query({
  args: { documentId: v.id("documents") },
  returns: v.union(v.null(), DOCUMENT_DOC),
  handler: async (ctx, args) => {
    const user = await getAuthedUserOrNull(ctx);
    if (!user) {
      throw new Error("Not authenticated");
    }
    return await documentForUser(ctx, user._id, args.documentId);
  },
});

export const getBody = query({
  args: { documentId: v.id("documents") },
  returns: v.union(
    v.null(),
    v.object({ content: v.string(), contentRev: v.number() }),
  ),
  handler: async (ctx, args) => {
    const user = await getAuthedUserOrNull(ctx);
    if (!user) {
      throw new Error("Not authenticated");
    }
    const document = await ctx.db.get(args.documentId);
    if (!document || document.trashedAt !== undefined) return null;
    const project = await ctx.db.get(document.projectId);
    if (!project || project.userId !== user._id) return null;
    return {
      content: await readContent(ctx, document),
      contentRev: document.contentRev ?? 0,
    };
  },
});

export const getBacklinks = query({
  args: { documentId: v.id("documents") },
  returns: v.array(
    v.object({
      _id: v.id("documents"),
      title: v.string(),
      status: v.string(),
      updatedAt: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    const user = await getAuthedUserOrNull(ctx);
    if (!user) return [];
    return await backlinksForUser(ctx, user._id, args.documentId);
  },
});

export async function backlinksForUser(
  ctx: QueryCtx,
  userId: Id<"users">,
  documentId: Id<"documents">,
) {
  const document = await ctx.db.get(documentId);
  if (!document) return [];
  const project = await ctx.db.get(document.projectId);
  if (!project || project.userId !== userId) return [];

  const edges = await ctx.db
    .query("document_links")
    .withIndex("by_targetDocumentId", (q) =>
      q.eq("targetDocumentId", documentId),
    )
    .take(50);

  const rows: {
    _id: Id<"documents">;
    title: string;
    status: string;
    updatedAt: number;
  }[] = [];
  for (const edge of edges) {
    const source = await ctx.db.get(edge.sourceDocumentId);
    if (!source || source.trashedAt !== undefined) continue;
    rows.push({
      _id: source._id,
      title: source.title,
      status: source.status,
      updatedAt: source.updatedAt,
    });
  }

  return rows.sort((a, b) => b.updatedAt - a.updatedAt);
}

export const create = mutation({
  args: {
    projectId: v.id("projects"),
    title: v.string(),
    slug: v.string(),
    status: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
    frontmatter: v.optional(v.string()),
    content: v.optional(v.string()),
  },
  returns: v.id("documents"),
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    return await createDocumentForUser(ctx, user, args);
  },
});

export async function createDocumentForUser(
  ctx: MutationCtx,
  user: Doc<"users">,
  args: {
    projectId: Id<"projects">;
    title: string;
    slug: string;
    status?: string;
    tags?: string[];
    frontmatter?: string;
    content?: string;
  },
): Promise<Id<"documents">> {
  await rateLimiter.limit(ctx, "documents:create", {
    key: user.tokenIdentifier,
    throws: true,
  });

  {
    const project = await ctx.db.get(args.projectId);
    if (!project) {
      throw new Error("Project not found");
    }

    if (project.userId !== user._id) {
      throw new Error("Unauthorized: you do not own this project");
    }

    const now = Date.now();

    const status = args.status ?? "draft";
    const documentId = await ctx.db.insert("documents", {
      projectId: args.projectId,
      userId: user._id,
      title: args.title,
      slug: args.slug,
      excerpt: args.content ? buildExcerpt(args.content) : "",
      wordCount: args.content ? countWords(args.content) : 0,
      status,
      createdAt: now,
      updatedAt: now,
      ...(args.tags !== undefined ? { tags: args.tags } : {}),
      ...(args.frontmatter !== undefined
        ? { frontmatter: args.frontmatter }
        : {}),
    });

    if (args.content) {
      const contentId = await ctx.db.insert("document_content", {
        documentId,
        projectId: args.projectId,
        userId: user._id,
        content: args.content,
        updatedAt: now,
      });
      await ctx.db.patch(documentId, { contentId });
    }

    await adjustDocumentCount(ctx, args.projectId, 1);
    await scheduleStatusChange(ctx, {
      projectId: args.projectId,
      userId: user._id,
      oldStatus: null,
      newStatus: status,
    });

    return documentId;
  }
}

export const update = mutation({
  args: {
    documentId: v.id("documents"),
    title: v.optional(v.string()),
    slug: v.optional(v.string()),
    content: v.optional(v.string()),
    frontmatter: v.optional(v.string()),
    status: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
    boardPosition: v.optional(v.number()),
  },
  returns: v.null(),
  handler: async (ctx, args) =>
    await updateDocumentForUser(ctx, await getCurrentUser(ctx), args),
});

export async function updateDocumentForUser(
  ctx: MutationCtx,
  user: Doc<"users">,
  args: {
    documentId: Id<"documents">;
    title?: string;
    slug?: string;
    content?: string;
    frontmatter?: string;
    status?: string;
    tags?: string[];
    boardPosition?: number;
  },
): Promise<null> {
  await rateLimiter.limit(ctx, "documents:update", {
    key: user.tokenIdentifier,
    throws: true,
  });

  const document = await verifyDocumentOwnership(
    ctx,
    args.documentId,
    user._id,
  );

  if (args.status !== undefined) {
    if (args.status === "scheduled") {
      throw new Error(
        "Use scheduling.schedule to move a document into the scheduled state.",
      );
    }
    if (args.status === "published") {
      throw new Error(
        "Use the publish action to publish a document; update cannot set status to 'published' directly.",
      );
    }
  }

  if (args.content !== undefined) {
    const byteLength = new TextEncoder().encode(args.content).byteLength;
    if (byteLength > MAX_CONTENT_BYTES) {
      throw new Error(
        `Document content is too large (max ${String(Math.round(MAX_CONTENT_BYTES / 1024))} KB).`,
      );
    }
  }

  const openConflict = await ctx.db
    .query("sync_conflicts")
    .withIndex("by_documentId_unresolved", (q) =>
      q.eq("documentId", args.documentId).eq("resolvedAt", undefined),
    )
    .first();
  if (openConflict) {
    throw new Error(
      "This document has a pending sync conflict. Resolve it before making changes.",
    );
  }

  const { documentId, content, ...updates } = args;
  const fieldsToUpdate: Record<string, unknown> = { updatedAt: Date.now() };

  for (const [key, value] of Object.entries(updates)) {
    if (value !== undefined) {
      fieldsToUpdate[key] = value;
    }
  }

  let wordCountDelta = 0;
  if (content !== undefined) {
    const contentId = await writeContent(ctx, {
      documentId,
      projectId: document.projectId,
      userId: user._id,
      content,
      ...(document.contentId ? { contentId: document.contentId } : {}),
    });
    const body = bodyMetadata(document, content, contentId);
    Object.assign(fieldsToUpdate, body.fields);
    wordCountDelta = body.wordCountDelta;
  }

  await ctx.db.patch(documentId, fieldsToUpdate);

  if (content !== undefined) {
    await syncDocumentLinks(ctx, document, content);
  }

  await scheduleWordActivity(ctx, {
    userId: user._id,
    projectId: document.projectId,
    wordCountDelta,
  });

  if (args.status !== undefined && args.status !== document.status) {
    await scheduleStatusChange(ctx, {
      projectId: document.projectId,
      userId: user._id,
      oldStatus: document.status,
      newStatus: args.status,
    });
  }
  return null;
}

function bodyMetadata(
  document: Doc<"documents">,
  content: string,
  contentId: Id<"document_content">,
) {
  const wordCount = countWords(content);
  return {
    fields: {
      wordCount,
      excerpt: buildExcerpt(content),
      ...(document.contentId !== contentId ? { contentId } : {}),
    },
    wordCountDelta: wordCount - (document.wordCount ?? 0),
  };
}

export const autosaveBody = mutation({
  args: {
    documentId: v.id("documents"),
    content: v.optional(v.string()),
    title: v.optional(v.string()),
    flush: v.optional(v.boolean()),
    writer: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const key = await getRateLimitKey(ctx);
    await rateLimiter.limit(ctx, "documents:update", { key, throws: true });
    if (args.content === undefined && args.flush !== true) {
      throw new Error("content is required unless flush is true");
    }

    const user = await getCurrentUser(ctx);
    const document = await verifyDocumentOwnership(
      ctx,
      args.documentId,
      user._id,
    );

    if (args.content !== undefined) {
      const byteLength = new TextEncoder().encode(args.content).byteLength;
      if (byteLength > MAX_CONTENT_BYTES) {
        throw new Error(
          `Document content is too large (max ${String(Math.round(MAX_CONTENT_BYTES / 1024))} KB).`,
        );
      }
    }

    const openConflict = await ctx.db
      .query("sync_conflicts")
      .withIndex("by_documentId_unresolved", (q) =>
        q.eq("documentId", args.documentId).eq("resolvedAt", undefined),
      )
      .first();
    if (openConflict) {
      throw new Error(
        "This document has a pending sync conflict. Resolve it before making changes.",
      );
    }

    const stored =
      args.content === undefined ? await loadContentRow(ctx, document) : null;
    const content = args.content ?? stored?.content ?? "";
    const contentId =
      stored?._id ??
      (await writeEditorContent(ctx, {
        documentId: args.documentId,
        projectId: document.projectId,
        userId: user._id,
        content,
        ...(document.contentId ? { contentId: document.contentId } : {}),
      }));

    const now = Date.now();
    const touch = shouldTouch({
      now,
      updatedAt: document.updatedAt,
      flush: args.flush === true,
      titleChanged: false,
    });
    if (touch && (args.flush === true || args.writer !== undefined)) {
      const body = bodyMetadata(document, content, contentId);
      await ctx.db.patch(args.documentId, {
        ...body.fields,
        ...(args.title !== undefined ? { title: args.title } : {}),
        contentRev: (document.contentRev ?? 0) + 1,
        contentWriter: args.writer,
        updatedAt: now,
      });
      await syncDocumentLinks(ctx, document, content);
      await scheduleWordActivity(ctx, {
        userId: user._id,
        projectId: document.projectId,
        wordCountDelta: body.wordCountDelta,
      });
      return null;
    }

    if (args.title !== undefined && args.title !== document.title) {
      await ctx.db.patch(args.documentId, {
        title: args.title,
        updatedAt: Date.now(),
      });
    }
    return null;
  },
});

const MAX_CONTENT_BYTES = 500 * 1024;

export const duplicate = mutation({
  args: {
    documentId: v.id("documents"),
  },
  returns: v.object({
    documentId: v.id("documents"),
    title: v.string(),
  }),
  handler: async (ctx, args) =>
    await duplicateDocumentForUser(ctx, await getCurrentUser(ctx), args),
});

async function duplicateDocumentForUser(
  ctx: MutationCtx,
  user: Doc<"users">,
  args: { documentId: Id<"documents"> },
): Promise<{ documentId: Id<"documents">; title: string }> {
  await rateLimiter.limit(ctx, "documents:duplicate", {
    key: user.tokenIdentifier,
    throws: true,
  });

  const doc = await verifyDocumentOwnership(ctx, args.documentId, user._id);

  const now = Date.now();
  const newTitle = `${doc.title} (copy)`;
  const newSlug = `${doc.slug}-copy-${Date.now().toString(36)}`;

  const sourceContent = await readContent(ctx, doc);
  const wc = countWords(sourceContent);
  const newId = await ctx.db.insert("documents", {
    projectId: doc.projectId,
    userId: user._id,
    title: newTitle,
    slug: newSlug,
    excerpt: buildExcerpt(sourceContent),
    wordCount: wc,
    status: doc.status,
    createdAt: now,
    updatedAt: now,
    ...(doc.frontmatter ? { frontmatter: doc.frontmatter } : {}),
    ...(doc.tags ? { tags: doc.tags } : {}),
  });
  const newContentId = await writeContent(ctx, {
    documentId: newId,
    projectId: doc.projectId,
    userId: user._id,
    content: sourceContent,
  });
  await ctx.db.patch(newId, { contentId: newContentId });
  await scheduleWordActivity(ctx, {
    userId: user._id,
    projectId: doc.projectId,
    wordCountDelta: wc,
  });
  await scheduleStatusChange(ctx, {
    projectId: doc.projectId,
    userId: user._id,
    oldStatus: null,
    newStatus: doc.status,
  });
  return { documentId: newId, title: newTitle };
}

export const updateStatusArgs = {
  documentId: v.id("documents"),
  status: v.string(),
};

export const updateStatus = mutation({
  args: updateStatusArgs,
  returns: v.null(),
  handler: async (ctx, args) =>
    await updateStatusForUser(ctx, await getCurrentUser(ctx), args),
});

async function updateStatusForUser(
  ctx: MutationCtx,
  user: Doc<"users">,
  args: ObjectType<typeof updateStatusArgs>,
): Promise<null> {
  await rateLimiter.limit(ctx, "documents:updateStatus", {
    key: user.tokenIdentifier,
    throws: true,
  });

  const doc = await verifyDocumentOwnership(ctx, args.documentId, user._id);

  const now = Date.now();
  const updates: DocPatch<"documents"> = {
    status: args.status,
    updatedAt: now,
  };

  if (args.status === "published") {
    updates.publishedAt = now;
  }

  if (doc.status === "scheduled" && args.status !== "scheduled") {
    updates.scheduledAt = undefined;
  }

  await ctx.db.patch(args.documentId, updates);

  if (args.status !== doc.status) {
    await scheduleStatusChange(ctx, {
      projectId: doc.projectId,
      userId: user._id,
      oldStatus: doc.status,
      newStatus: args.status,
    });
  }
  return null;
}

export const remove = mutation({
  args: { documentId: v.id("documents") },
  returns: v.null(),
  handler: async (ctx, args) =>
    await trashDocumentForUser(ctx, await getCurrentUser(ctx), args),
});

export async function trashDocumentForUser(
  ctx: MutationCtx,
  user: Doc<"users">,
  args: { documentId: Id<"documents"> },
): Promise<null> {
  await rateLimiter.limit(ctx, "documents:remove", {
    key: user.tokenIdentifier,
    throws: true,
  });

  const document = await verifyDocumentOwnership(
    ctx,
    args.documentId,
    user._id,
  );

  await cascadeDeleteScheduledPublishesForDoc(ctx, args.documentId);
  await ctx.db.patch(args.documentId, { trashedAt: Date.now() });
  await adjustDocumentCount(ctx, document.projectId, -1);
  await scheduleWordActivity(ctx, {
    userId: user._id,
    projectId: document.projectId,
    wordCountDelta: -(document.wordCount ?? 0),
  });
  await scheduleStatusChange(ctx, {
    projectId: document.projectId,
    userId: user._id,
    oldStatus: document.status,
    newStatus: null,
  });
  return null;
}

export const _importFromGithubInternal = internalMutation({
  args: {
    projectId: v.id("projects"),
    title: v.string(),
    slug: v.string(),
    content: v.string(),
    frontmatter: v.optional(v.string()),
    githubPath: v.string(),
    githubSha: v.string(),
  },
  returns: v.id("documents"),
  handler: async (ctx, args): Promise<Id<"documents">> => {
    const project = await ctx.db.get(args.projectId);
    if (!project) {
      throw new Error("Project not found");
    }

    const duplicate = await ctx.db
      .query("documents")
      .withIndex("by_projectId_and_githubPath", (q) =>
        q.eq("projectId", args.projectId).eq("githubPath", args.githubPath),
      )
      .unique();
    if (duplicate) return duplicate._id;

    const now = Date.now();
    const wc = countWords(args.content);
    const id = await ctx.db.insert("documents", {
      projectId: args.projectId,
      userId: project.userId,
      title: args.title,
      slug: args.slug,
      excerpt: buildExcerpt(args.content),
      wordCount: wc,
      status: "published",
      githubPath: args.githubPath,
      githubSha: args.githubSha,
      githubSyncedAt: now,
      publishedAt: now,
      createdAt: now,
      updatedAt: now,
      ...(args.frontmatter !== undefined && { frontmatter: args.frontmatter }),
    });
    const contentId = await writeContent(ctx, {
      documentId: id,
      projectId: args.projectId,
      userId: project.userId,
      content: args.content,
    });
    await ctx.db.patch(id, { contentId });
    await adjustDocumentCount(ctx, args.projectId, 1);
    await scheduleWordActivity(ctx, {
      userId: project.userId,
      projectId: args.projectId,
      wordCountDelta: wc,
    });
    await scheduleStatusChange(ctx, {
      projectId: args.projectId,
      userId: project.userId,
      oldStatus: null,
      newStatus: "published",
    });
    return id;
  },
});

export const toggleBookmark = mutation({
  args: { documentId: v.id("documents") },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const key = await getRateLimitKey(ctx);
    await rateLimiter.limit(ctx, "documents:toggleBookmark", {
      key,
      throws: true,
    });

    const user = await getCurrentUser(ctx);
    const document = await verifyDocumentOwnership(
      ctx,
      args.documentId,
      user._id,
    );

    const newBookmarked = !document.bookmarked;
    await ctx.db.patch(args.documentId, {
      bookmarked: newBookmarked,
      updatedAt: Date.now(),
    });

    return newBookmarked;
  },
});

export const internalGet = internalQuery({
  args: { documentId: v.id("documents") },
  returns: v.union(v.null(), DOCUMENT_DOC_WITH_CONTENT),
  handler: async (ctx, args) => {
    const document = await ctx.db.get(args.documentId);
    if (!document) return null;
    const content = await readContent(ctx, document);
    return { ...document, content };
  },
});

export const _listByIdsForProject = internalQuery({
  args: {
    ids: v.array(v.id("documents")),
    projectId: v.id("projects"),
  },
  returns: v.array(DOCUMENT_DOC),
  handler: async (ctx, args) => {
    const docs = await Promise.all(args.ids.map((id) => ctx.db.get(id)));
    return docs.filter(
      (d): d is NonNullable<typeof d> =>
        d !== null &&
        d.projectId === args.projectId &&
        d.trashedAt === undefined,
    );
  },
});

export const moveCard = mutation({
  args: {
    documentId: v.id("documents"),
    targetStatus: v.string(),
    boardPosition: v.number(),
  },
  returns: v.object({ behavior: v.string() }),
  handler: async (ctx, args) => {
    const key = await getRateLimitKey(ctx);
    await rateLimiter.limit(ctx, "documents:moveCard", { key, throws: true });

    if (!Number.isFinite(args.boardPosition)) {
      throw new Error("boardPosition must be a finite number");
    }
    const clampedPosition = Math.max(
      0,
      Math.min(args.boardPosition, Number.MAX_SAFE_INTEGER),
    );

    const user = await getCurrentUser(ctx);
    const document = await verifyDocumentOwnership(
      ctx,
      args.documentId,
      user._id,
    );

    const updates: DocPatch<"documents"> = {
      status: args.targetStatus,
      boardPosition: clampedPosition,
      updatedAt: Date.now(),
    };

    const project = await ctx.db.get(document.projectId as Id<"projects">);
    let behavior = "none";

    if (project && "boardColumns" in project && project.boardColumns) {
      try {
        const columns = JSON.parse(project.boardColumns) as Array<{
          id: string;
          behavior: string;
        }>;
        const targetCol = columns.find((c) => c.id === args.targetStatus);
        if (targetCol) {
          behavior = targetCol.behavior;
          if (targetCol.behavior === "publish") {
            updates.publishedAt = Date.now();
          }
        }
      } catch {}
    } else {
      if (args.targetStatus === "published") {
        updates.publishedAt = Date.now();
        behavior = "publish";
      } else if (args.targetStatus === "scheduled") {
        behavior = "schedule";
      }
    }

    await ctx.db.patch(args.documentId, updates);

    if (args.targetStatus !== document.status) {
      await scheduleStatusChange(ctx, {
        projectId: document.projectId,
        userId: user._id,
        oldStatus: document.status,
        newStatus: args.targetStatus,
      });
    }

    return { behavior };
  },
});

export const updateTagsArgs = {
  documentId: v.id("documents"),
  tags: v.array(v.string()),
};

export const updateTags = mutation({
  args: updateTagsArgs,
  returns: v.null(),
  handler: async (ctx, args) =>
    await updateTagsForUser(ctx, await getCurrentUser(ctx), args),
});

async function updateTagsForUser(
  ctx: MutationCtx,
  user: Doc<"users">,
  args: ObjectType<typeof updateTagsArgs>,
): Promise<null> {
  await rateLimiter.limit(ctx, "documents:updateTags", {
    key: user.tokenIdentifier,
    throws: true,
  });

  await verifyDocumentOwnership(ctx, args.documentId, user._id);

  const doc = await ctx.db.get(args.documentId);

  let parsed: unknown = {};
  if (doc?.frontmatter) {
    try {
      parsed = JSON.parse(doc.frontmatter);
    } catch {
      parsed = null;
    }
  }
  const mergeable =
    typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)
      ? parsed
      : null;

  await ctx.db.patch(args.documentId, {
    tags: args.tags,
    ...(mergeable !== null
      ? { frontmatter: JSON.stringify({ ...mergeable, tags: args.tags }) }
      : {}),
    updatedAt: Date.now(),
  });
  return null;
}

export const internalUpdateAfterPublish = internalMutation({
  args: {
    documentId: v.id("documents"),
    githubPath: v.string(),
    githubSha: v.optional(v.string()),
    status: v.string(),
    publishedAt: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const doc = await ctx.db.get(args.documentId);
    const patch: DocPatch<"documents"> = {
      githubPath: args.githubPath,
      githubSyncedAt: Date.now(),
      status: args.status,
      publishedAt: args.publishedAt,
      updatedAt: Date.now(),
    };
    if (args.githubSha !== undefined) {
      patch.githubSha = args.githubSha;
    }
    await ctx.db.patch(args.documentId, patch);

    if (doc && args.status !== doc.status) {
      await scheduleStatusChange(ctx, {
        projectId: doc.projectId,
        userId: doc.userId,
        oldStatus: doc.status,
        newStatus: args.status,
      });
    }
    if (doc && args.status === "published") {
      await ctx.scheduler.runAfter(
        0,
        internal.analytics.writingStats._incrementPublished,
        { userId: doc.userId },
      );
    }
    return null;
  },
});

export const internalRecordPublishHistory = internalMutation({
  args: {
    documentId: v.id("documents"),
    projectId: v.id("projects"),
    userId: v.id("users"),
    commitSha: v.string(),
    commitUrl: v.optional(v.string()),
    githubPath: v.string(),
    commitMessage: v.string(),
    contentSnapshot: v.string(),
    frontmatterSnapshot: v.optional(v.string()),
    titleSnapshot: v.string(),
    isUpdate: v.boolean(),
    isBulk: v.optional(v.boolean()),
    bulkBatchId: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { contentSnapshot, frontmatterSnapshot, ...metadata } = args;
    const publishId = await ctx.db.insert("publish_history", {
      ...metadata,
      createdAt: Date.now(),
    });
    await ctx.db.insert("publish_history_content", {
      publishId,
      documentId: args.documentId,
      projectId: args.projectId,
      userId: args.userId,
      content: contentSnapshot,
      ...(frontmatterSnapshot !== undefined
        ? { frontmatter: frontmatterSnapshot }
        : {}),
    });

    const PUBLISH_HISTORY_CAP = 50;
    const overflow = await ctx.db
      .query("publish_history")
      .withIndex("by_documentId", (q) => q.eq("documentId", args.documentId))
      .order("desc")
      .take(PUBLISH_HISTORY_CAP + 10);
    for (const row of overflow.slice(PUBLISH_HISTORY_CAP)) {
      const contentRow = await ctx.db
        .query("publish_history_content")
        .withIndex("by_publishId", (q) => q.eq("publishId", row._id))
        .unique();
      if (contentRow) await ctx.db.delete(contentRow._id);
      await ctx.db.delete(row._id);
    }
    return null;
  },
});

export const getPublishHistory = query({
  args: {
    documentId: v.id("documents"),
  },
  returns: v.array(
    v.object({
      _id: v.id("publish_history"),
      commitSha: v.string(),
      commitUrl: v.optional(v.string()),
      commitMessage: v.string(),
      githubPath: v.string(),
      titleSnapshot: v.string(),
      isUpdate: v.boolean(),
      isBulk: v.optional(v.boolean()),
      createdAt: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    const user = await getAuthedUserOrNull(ctx);
    if (!user) return [];
    return await publishHistoryForUser(ctx, user._id, args.documentId);
  },
});

export async function publishHistoryForUser(
  ctx: QueryCtx,
  userId: Id<"users">,
  documentId: Id<"documents">,
) {
  const document = await ctx.db.get(documentId);
  if (!document) return [];
  const project = await ctx.db.get(document.projectId);
  if (!project || project.userId !== userId) return [];

  const history = await ctx.db
    .query("publish_history")
    .withIndex("by_documentId", (q) => q.eq("documentId", documentId))
    .order("desc")
    .take(100);

  return history.map((h) => ({
    _id: h._id,
    commitSha: h.commitSha,
    ...(h.commitUrl !== undefined ? { commitUrl: h.commitUrl } : {}),
    commitMessage: h.commitMessage,
    githubPath: h.githubPath,
    titleSnapshot: h.titleSnapshot,
    isUpdate: h.isUpdate,
    ...(h.isBulk !== undefined ? { isBulk: h.isBulk } : {}),
    createdAt: h.createdAt,
  }));
}

const PUBLISH_SNAPSHOT = v.object({
  content: v.string(),
  frontmatter: v.optional(v.string()),
  titleSnapshot: v.string(),
  commitSha: v.string(),
  createdAt: v.number(),
});

export const getPublishDiff = query({
  args: { historyId: v.id("publish_history") },
  returns: v.union(
    v.null(),
    v.object({
      current: PUBLISH_SNAPSHOT,
      previous: v.union(v.null(), PUBLISH_SNAPSHOT),
    }),
  ),
  handler: async (ctx, args) => {
    const user = await getAuthedUserOrNull(ctx);
    if (!user) return null;

    const entry = await ctx.db.get(args.historyId);
    if (!entry || entry.userId !== user._id) return null;

    const loadSnapshot = async (row: {
      _id: Id<"publish_history">;
      titleSnapshot: string;
      commitSha: string;
      createdAt: number;
    }) => {
      const contentRow = await ctx.db
        .query("publish_history_content")
        .withIndex("by_publishId", (q) => q.eq("publishId", row._id))
        .unique();
      if (!contentRow) return null;
      return {
        content: contentRow.content,
        ...(contentRow.frontmatter !== undefined
          ? { frontmatter: contentRow.frontmatter }
          : {}),
        titleSnapshot: row.titleSnapshot,
        commitSha: row.commitSha,
        createdAt: row.createdAt,
      };
    };

    const current = await loadSnapshot(entry);
    if (!current) return null;

    const older = await ctx.db
      .query("publish_history")
      .withIndex("by_documentId", (q) => q.eq("documentId", entry.documentId))
      .order("desc")
      .take(60);
    const previousRow = older.find((r) => r.createdAt < entry.createdAt);
    const previous = previousRow ? await loadSnapshot(previousRow) : null;

    return { current, previous };
  },
});

export const rollbackToVersion = mutation({
  args: {
    documentId: v.id("documents"),
    historyId: v.id("publish_history"),
  },
  returns: v.object({
    title: v.string(),
    restoredFrom: v.number(),
  }),
  handler: async (ctx, args) =>
    await rollbackDocumentForUser(ctx, await getCurrentUser(ctx), args),
});

async function rollbackDocumentForUser(
  ctx: MutationCtx,
  user: Doc<"users">,
  args: { documentId: Id<"documents">; historyId: Id<"publish_history"> },
) {
  await rateLimiter.limit(ctx, "documents:rollbackToVersion", {
    key: user.tokenIdentifier,
    throws: true,
  });

  const document = await ctx.db.get(args.documentId);
  if (!document) throw new Error("Document not found");
  const project = await ctx.db.get(document.projectId);
  if (!project || project.userId !== user._id) {
    throw new Error("Unauthorized");
  }

  const historyEntry = await ctx.db.get(args.historyId);
  if (!historyEntry || historyEntry.documentId !== args.documentId) {
    throw new Error(
      "History entry not found or does not belong to this document",
    );
  }

  const contentRow = await ctx.db
    .query("publish_history_content")
    .withIndex("by_publishId", (q) => q.eq("publishId", args.historyId))
    .unique();
  if (!contentRow) {
    throw new Error(
      "Publish snapshot content is missing; cannot roll back to this version.",
    );
  }
  const content = contentRow.content;
  const frontmatter = contentRow.frontmatter;

  const newContentId = await writeContent(ctx, {
    documentId: args.documentId,
    projectId: document.projectId,
    userId: document.userId,
    content,
    ...(document.contentId ? { contentId: document.contentId } : {}),
  });
  const patch: DocPatch<"documents"> = {
    title: historyEntry.titleSnapshot,
    excerpt: buildExcerpt(content),
    wordCount: countWords(content),
    frontmatter,
    updatedAt: Date.now(),
  };
  if (document.contentId === undefined) {
    patch.contentId = newContentId;
  }
  await ctx.db.patch(args.documentId, patch);

  return {
    title: historyEntry.titleSnapshot,
    restoredFrom: historyEntry.createdAt,
  };
}

export const listForCalendar = query({
  args: { projectId: v.id("projects") },
  returns: v.array(
    v.object({
      _id: v.id("documents"),
      title: v.string(),
      slug: v.string(),
      status: v.string(),
      scheduledAt: v.optional(v.number()),
      publishedAt: v.optional(v.number()),
      updatedAt: v.number(),
      createdAt: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    const user = await getAuthedUserOrNull(ctx);
    if (!user) return [];
    return await calendarForUser(ctx, user._id, args.projectId);
  },
});

export async function calendarForUser(
  ctx: QueryCtx,
  userId: Id<"users">,
  projectId: Id<"projects">,
) {
  const project = await ctx.db.get(projectId);
  if (!project || project.userId !== userId) return [];

  const documents = await ctx.db
    .query("documents")
    .withIndex("by_projectId_and_trashedAt", (q) =>
      q.eq("projectId", projectId).eq("trashedAt", undefined),
    )
    .order("desc")
    .take(500);

  return documents.reverse().map((d) => ({
    _id: d._id,
    title: d.title,
    slug: d.slug,
    status: d.status,
    ...(d.scheduledAt !== undefined ? { scheduledAt: d.scheduledAt } : {}),
    ...(d.publishedAt !== undefined ? { publishedAt: d.publishedAt } : {}),
    updatedAt: d.updatedAt,
    createdAt: d.createdAt,
  }));
}

export const listForCalendarAllProjects = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("documents"),
      projectId: v.id("projects"),
      projectName: v.string(),
      title: v.string(),
      status: v.string(),
      scheduledAt: v.optional(v.number()),
      publishedAt: v.optional(v.number()),
    }),
  ),
  handler: async (ctx) => {
    const user = await getAuthedUserOrNull(ctx);
    if (!user) return [];
    return await allProjectsCalendarForUser(ctx, user._id);
  },
});

async function allProjectsCalendarForUser(ctx: QueryCtx, userId: Id<"users">) {
  const projects = await ctx.db
    .query("projects")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .take(25);

  const rows: Array<{
    _id: Id<"documents">;
    projectId: Id<"projects">;
    projectName: string;
    title: string;
    status: string;
    scheduledAt?: number;
    publishedAt?: number;
  }> = [];

  for (const project of projects) {
    const documents = await ctx.db
      .query("documents")
      .withIndex("by_projectId_and_trashedAt", (q) =>
        q.eq("projectId", project._id).eq("trashedAt", undefined),
      )
      .take(300);
    for (const d of documents) {
      if (d.scheduledAt === undefined && d.publishedAt === undefined) {
        continue;
      }
      rows.push({
        _id: d._id,
        projectId: project._id,
        projectName: project.name,
        title: d.title,
        status: d.status,
        ...(d.scheduledAt !== undefined ? { scheduledAt: d.scheduledAt } : {}),
        ...(d.publishedAt !== undefined ? { publishedAt: d.publishedAt } : {}),
      });
    }
  }
  return rows;
}

export const listStale = query({
  args: {
    projectId: v.id("projects"),
    olderThanMonths: v.optional(v.number()),
  },
  returns: v.array(
    v.object({
      _id: v.id("documents"),
      title: v.string(),
      slug: v.string(),
      updatedAt: v.number(),
      publishedAt: v.optional(v.number()),
      wordCount: v.optional(v.number()),
    }),
  ),
  handler: async (ctx, args) => {
    const user = await getAuthedUserOrNull(ctx);
    if (!user) return [];
    return await staleDocumentsForUser(ctx, user._id, args);
  },
});

async function staleDocumentsForUser(
  ctx: QueryCtx,
  userId: Id<"users">,
  args: { projectId: Id<"projects">; olderThanMonths?: number },
) {
  const project = await ctx.db.get(args.projectId);
  if (!project || project.userId !== userId) {
    return [];
  }

  const months = Math.min(24, Math.max(1, args.olderThanMonths ?? 6));
  const cutoff = Date.now() - months * 30 * 24 * 60 * 60 * 1000;

  const published = await ctx.db
    .query("documents")
    .withIndex("by_projectId_and_status", (q) =>
      q.eq("projectId", args.projectId).eq("status", "published"),
    )
    .take(500);

  return published
    .filter((d) => d.trashedAt === undefined && d.updatedAt < cutoff)
    .sort((a, b) => a.updatedAt - b.updatedAt)
    .slice(0, 10)
    .map((d) => ({
      _id: d._id,
      title: d.title,
      slug: d.slug,
      updatedAt: d.updatedAt,
      ...(d.publishedAt !== undefined ? { publishedAt: d.publishedAt } : {}),
      ...(d.wordCount !== undefined ? { wordCount: d.wordCount } : {}),
    }));
}

export const _createImportBatch = internalMutation({
  args: {
    projectId: v.id("projects"),
    userId: v.id("users"),
    total: v.number(),
  },
  returns: v.id("import_batches"),
  handler: async (ctx, args): Promise<Id<"import_batches">> => {
    const now = Date.now();
    return await ctx.db.insert("import_batches", {
      projectId: args.projectId,
      userId: args.userId,
      total: args.total,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const _onImportFileComplete = internalMutation({
  args: vOnCompleteArgs(
    v.object({ batchId: v.id("import_batches"), filePath: v.string() }),
  ),
  returns: v.null(),
  handler: async (ctx, args) => {
    const { batchId, filePath } = args.context;
    const { result } = args;

    const batch = await ctx.db.get(batchId);
    if (!batch) return null;

    if (result.kind === "success") {
      await ctx.db.insert("import_job_outcomes", {
        batchId,
        status: "success",
        filePath,
        createdAt: Date.now(),
      });
      return null;
    }

    const errorMessage =
      result.kind === "failed" ? result.error : "Import cancelled";
    await ctx.db.insert("import_job_outcomes", {
      batchId,
      status: "failure",
      filePath,
      errorMessage,
      createdAt: Date.now(),
    });
    return null;
  },
});

export const getImportBatch = query({
  args: { batchId: v.id("import_batches") },
  returns: v.union(
    v.null(),
    v.object({
      _id: v.id("import_batches"),
      _creationTime: v.number(),
      projectId: v.id("projects"),
      userId: v.id("users"),
      total: v.number(),
      succeeded: v.number(),
      failed: v.number(),
      errors: v.array(v.object({ filePath: v.string(), message: v.string() })),
      createdAt: v.number(),
      updatedAt: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    const user = await getAuthedUserOrNull(ctx);
    if (!user) return null;

    const batch = await ctx.db.get(args.batchId);
    if (!batch || batch.userId !== user._id) return null;

    const outcomes = await ctx.db
      .query("import_job_outcomes")
      .withIndex("by_batchId", (q) => q.eq("batchId", args.batchId))
      .take(500);

    let succeeded = 0;
    let failed = 0;
    const MAX_ERRORS_RETURNED = 20;
    const errors: Array<{ filePath: string; message: string }> = [];
    for (const o of outcomes) {
      if (o.status === "success") {
        succeeded += 1;
      } else {
        failed += 1;
        if (errors.length < MAX_ERRORS_RETURNED) {
          errors.push({
            filePath: o.filePath,
            message: o.errorMessage ?? "Unknown error",
          });
        }
      }
    }

    return {
      ...batch,
      succeeded,
      failed,
      errors,
    };
  },
});

export const _removeInternal = internalMutation({
  args: {
    documentId: v.id("documents"),
    projectId: v.id("projects"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const doc = await ctx.db.get(args.documentId);
    if (!doc) return null;
    if (doc.projectId !== args.projectId) {
      return null;
    }
    if (doc.trashedAt !== undefined) {
      return null;
    }

    await cascadeDeleteScheduledPublishesForDoc(ctx, args.documentId);
    await ctx.db.patch(args.documentId, { trashedAt: Date.now() });
    await adjustDocumentCount(ctx, args.projectId, -1);
    const project = await ctx.db.get(args.projectId);
    if (project) {
      await scheduleWordActivity(ctx, {
        userId: project.userId,
        projectId: args.projectId,
        wordCountDelta: -(doc.wordCount ?? 0),
      });
      await scheduleStatusChange(ctx, {
        projectId: args.projectId,
        userId: project.userId,
        oldStatus: doc.status,
        newStatus: null,
      });
    }
    return null;
  },
});

export const _bulkSoftDeleteLocal = internalMutation({
  args: {
    projectId: v.id("projects"),
    documentIds: v.array(v.id("documents")),
  },
  returns: v.object({ trashed: v.number() }),
  handler: async (ctx, args): Promise<{ trashed: number }> => {
    const now = Date.now();
    let trashed = 0;
    let totalWordsDelta = 0;
    const statusDeltas: Record<string, number> = {};
    let userId: Id<"users"> | null = null;
    for (const id of args.documentIds) {
      const doc = await ctx.db.get(id);
      if (!doc) continue;
      if (doc.projectId !== args.projectId) continue;
      if (doc.trashedAt !== undefined) continue;
      await cascadeDeleteScheduledPublishesForDoc(ctx, id);
      await ctx.db.patch(id, { trashedAt: now });
      await adjustDocumentCount(ctx, args.projectId, -1);
      totalWordsDelta -= doc.wordCount ?? 0;
      statusDeltas[doc.status] = (statusDeltas[doc.status] ?? 0) - 1;
      userId = doc.userId;
      trashed += 1;
    }
    if (userId && totalWordsDelta !== 0) {
      await scheduleWordActivity(ctx, {
        userId,
        projectId: args.projectId,
        wordCountDelta: totalWordsDelta,
      });
    }
    if (userId) {
      for (const [status, delta] of Object.entries(statusDeltas)) {
        if (delta === 0) continue;
        await scheduleStatusChange(ctx, {
          projectId: args.projectId,
          userId,
          oldStatus: delta < 0 ? status : null,
          newStatus: delta > 0 ? status : null,
          count: Math.abs(delta),
        });
      }
    }
    return { trashed };
  },
});

export async function cascadeDeleteScheduledPublishesForDoc(
  ctx: { db: MutationCtxDb },
  documentId: Id<"documents">,
): Promise<void> {
  const scheduledPublishes = await ctx.db
    .query("scheduled_publishes")
    .withIndex("by_documentId", (q) => q.eq("documentId", documentId))
    .take(50);
  for (const sp of scheduledPublishes) {
    await ctx.db.delete(sp._id);
  }
}

type MutationCtxDb = import("../_generated/server").MutationCtx["db"];

export const _createDeleteBatch = internalMutation({
  args: {
    projectId: v.id("projects"),
    userId: v.id("users"),
    mode: v.union(v.literal("local"), v.literal("github"), v.literal("both")),
    total: v.number(),
  },
  returns: v.id("delete_batches"),
  handler: async (ctx, args): Promise<Id<"delete_batches">> => {
    const now = Date.now();
    return await ctx.db.insert("delete_batches", {
      projectId: args.projectId,
      userId: args.userId,
      mode: args.mode,
      total: args.total,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const _onDeleteFileComplete = internalMutation({
  args: vOnCompleteArgs(
    v.object({ batchId: v.id("delete_batches"), label: v.string() }),
  ),
  returns: v.null(),
  handler: async (ctx, args) => {
    const { batchId, label } = args.context;
    const { result } = args;

    const batch = await ctx.db.get(batchId);
    if (!batch) return null;

    if (result.kind === "success") {
      await ctx.db.insert("delete_job_outcomes", {
        batchId,
        status: "success",
        label,
        createdAt: Date.now(),
      });
      return null;
    }

    const errorMessage =
      result.kind === "failed" ? result.error : "Delete cancelled";
    await ctx.db.insert("delete_job_outcomes", {
      batchId,
      status: "failure",
      label,
      errorMessage,
      createdAt: Date.now(),
    });
    return null;
  },
});

export const getDeleteBatch = query({
  args: { batchId: v.id("delete_batches") },
  returns: v.union(
    v.null(),
    v.object({
      _id: v.id("delete_batches"),
      _creationTime: v.number(),
      projectId: v.id("projects"),
      userId: v.id("users"),
      mode: v.union(v.literal("local"), v.literal("github"), v.literal("both")),
      total: v.number(),
      succeeded: v.number(),
      failed: v.number(),
      errors: v.array(v.object({ label: v.string(), message: v.string() })),
      createdAt: v.number(),
      updatedAt: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    const user = await getAuthedUserOrNull(ctx);
    if (!user) return null;

    const batch = await ctx.db.get(args.batchId);
    if (!batch || batch.userId !== user._id) return null;

    const outcomes = await ctx.db
      .query("delete_job_outcomes")
      .withIndex("by_batchId", (q) => q.eq("batchId", args.batchId))
      .take(500);

    let succeeded = 0;
    let failed = 0;
    const MAX_ERRORS_RETURNED = 20;
    const errors: Array<{ label: string; message: string }> = [];
    for (const o of outcomes) {
      if (o.status === "success") {
        succeeded += 1;
      } else {
        failed += 1;
        if (errors.length < MAX_ERRORS_RETURNED) {
          errors.push({
            label: o.label,
            message: o.errorMessage ?? "Unknown error",
          });
        }
      }
    }

    return {
      ...batch,
      succeeded,
      failed,
      errors,
    };
  },
});

export const _getExistingGithubFilesByPaths = internalQuery({
  args: {
    projectId: v.id("projects"),
    paths: v.array(v.string()),
  },
  returns: v.array(
    v.object({
      documentId: v.id("documents"),
      githubPath: v.string(),
      githubSha: v.optional(v.string()),
      updatedAt: v.number(),
      githubSyncedAt: v.optional(v.number()),
      content: v.string(),
      frontmatter: v.optional(v.string()),
    }),
  ),
  handler: async (ctx, args) => {
    const results: Array<{
      documentId: Id<"documents">;
      githubPath: string;
      githubSha?: string;
      updatedAt: number;
      githubSyncedAt?: number;
      content: string;
      frontmatter?: string;
    }> = [];
    for (const path of args.paths) {
      const doc = await ctx.db
        .query("documents")
        .withIndex("by_projectId_and_githubPath", (q) =>
          q.eq("projectId", args.projectId).eq("githubPath", path),
        )
        .unique();
      if (!doc || doc.trashedAt !== undefined) continue;
      results.push({
        documentId: doc._id,
        githubPath: path,
        ...(doc.githubSha !== undefined ? { githubSha: doc.githubSha } : {}),
        updatedAt: doc.updatedAt,
        ...(doc.githubSyncedAt !== undefined
          ? { githubSyncedAt: doc.githubSyncedAt }
          : {}),
        content: await readContent(ctx, doc),
        ...(doc.frontmatter !== undefined
          ? { frontmatter: doc.frontmatter }
          : {}),
      });
    }
    return results;
  },
});

export const _upsertImportedDocument = internalMutation({
  args: {
    projectId: v.id("projects"),
    title: v.string(),
    slug: v.string(),
    content: v.string(),
    frontmatter: v.optional(v.string()),
    githubPath: v.string(),
    githubSha: v.string(),
    githubSyncedAt: v.number(),
    mode: v.union(v.literal("new"), v.literal("fastForward")),
  },
  returns: v.id("documents"),
  handler: async (ctx, args): Promise<Id<"documents">> => {
    const project = await ctx.db.get(args.projectId);
    if (!project) throw new Error("Project not found");

    const existing = await ctx.db
      .query("documents")
      .withIndex("by_projectId_and_githubPath", (q) =>
        q.eq("projectId", args.projectId).eq("githubPath", args.githubPath),
      )
      .unique();

    const now = Date.now();

    const newWc = countWords(args.content);

    if (args.mode === "fastForward" && existing) {
      const oldWc = existing.wordCount ?? 0;
      const patch: DocPatch<"documents"> = {
        title: args.title,
        slug: args.slug,
        excerpt: buildExcerpt(args.content),
        wordCount: newWc,
        githubSha: args.githubSha,
        githubSyncedAt: args.githubSyncedAt,
        updatedAt: now,
      };
      if (args.frontmatter !== undefined) {
        patch.frontmatter = args.frontmatter;
      }
      const contentId = await writeContent(ctx, {
        documentId: existing._id,
        projectId: args.projectId,
        userId: project.userId,
        content: args.content,
        ...(existing.contentId ? { contentId: existing.contentId } : {}),
      });
      if (existing.contentId === undefined) {
        patch.contentId = contentId;
      }
      await ctx.db.patch(existing._id, patch);
      await scheduleWordActivity(ctx, {
        userId: project.userId,
        projectId: args.projectId,
        wordCountDelta: newWc - oldWc,
      });
      return existing._id;
    }

    if (existing) {
      const oldWc = existing.wordCount ?? 0;
      const patch: DocPatch<"documents"> = {
        excerpt: buildExcerpt(args.content),
        wordCount: newWc,
        githubSha: args.githubSha,
        githubSyncedAt: args.githubSyncedAt,
        updatedAt: now,
      };
      if (args.frontmatter !== undefined) {
        patch.frontmatter = args.frontmatter;
      }
      const contentId = await writeContent(ctx, {
        documentId: existing._id,
        projectId: args.projectId,
        userId: project.userId,
        content: args.content,
        ...(existing.contentId ? { contentId: existing.contentId } : {}),
      });
      if (existing.contentId === undefined) {
        patch.contentId = contentId;
      }
      await ctx.db.patch(existing._id, patch);
      await scheduleWordActivity(ctx, {
        userId: project.userId,
        projectId: args.projectId,
        wordCountDelta: newWc - oldWc,
      });
      return existing._id;
    }

    const id = await ctx.db.insert("documents", {
      projectId: args.projectId,
      userId: project.userId,
      title: args.title,
      slug: args.slug,
      excerpt: buildExcerpt(args.content),
      wordCount: newWc,
      status: "published",
      githubPath: args.githubPath,
      githubSha: args.githubSha,
      githubSyncedAt: args.githubSyncedAt,
      publishedAt: now,
      createdAt: now,
      updatedAt: now,
      ...(args.frontmatter !== undefined && { frontmatter: args.frontmatter }),
    });
    const contentId = await writeContent(ctx, {
      documentId: id,
      projectId: args.projectId,
      userId: project.userId,
      content: args.content,
    });
    await ctx.db.patch(id, { contentId });
    await adjustDocumentCount(ctx, args.projectId, 1);
    await scheduleWordActivity(ctx, {
      userId: project.userId,
      projectId: args.projectId,
      wordCountDelta: newWc,
    });
    await scheduleStatusChange(ctx, {
      projectId: args.projectId,
      userId: project.userId,
      oldStatus: null,
      newStatus: "published",
    });
    return id;
  },
});

const BACKFILL_BATCH_SIZE = 100;

export const _backfillGithubSyncedAt = internalMutation({
  args: {
    cursor: v.optional(v.union(v.string(), v.null())),
  },
  returns: v.object({
    patched: v.number(),
    scanned: v.number(),
    isDone: v.boolean(),
    cursor: v.string(),
  }),
  handler: async (ctx, args) => {
    const now = Date.now();
    let patched = 0;
    const result = await ctx.db.query("documents").paginate({
      numItems: BACKFILL_BATCH_SIZE,
      cursor: args.cursor ?? null,
    });
    for (const doc of result.page) {
      if (doc.githubSha && doc.githubSyncedAt === undefined) {
        await ctx.db.patch(doc._id, { githubSyncedAt: now });
        patched += 1;
      }
    }
    if (!result.isDone) {
      await ctx.scheduler.runAfter(
        0,
        internal.cms.documents._backfillGithubSyncedAt,
        { cursor: result.continueCursor },
      );
    }
    return {
      patched,
      scanned: result.page.length,
      isDone: result.isDone,
      cursor: result.continueCursor,
    };
  },
});

const BACKFILL_LINKS_BATCH_SIZE = 10;

export const _backfillDocumentLinks = internalMutation({
  args: {
    cursor: v.optional(v.union(v.string(), v.null())),
  },
  returns: v.object({
    synced: v.number(),
    scanned: v.number(),
    isDone: v.boolean(),
    cursor: v.string(),
  }),
  handler: async (ctx, args) => {
    let synced = 0;
    const result = await ctx.db.query("documents").paginate({
      numItems: BACKFILL_LINKS_BATCH_SIZE,
      cursor: args.cursor ?? null,
    });
    for (const doc of result.page) {
      if (doc.trashedAt !== undefined) continue;
      const content = await readContentById(ctx, doc._id);
      await syncDocumentLinks(ctx, doc, content);
      synced += 1;
    }
    if (!result.isDone) {
      await ctx.scheduler.runAfter(
        0,
        internal.cms.documents._backfillDocumentLinks,
        { cursor: result.continueCursor },
      );
    }
    return {
      synced,
      scanned: result.page.length,
      isDone: result.isDone,
      cursor: result.continueCursor,
    };
  },
});
