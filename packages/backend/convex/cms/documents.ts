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
import { adjustDocumentCount } from "../_lib/documentCount";
import {
  scheduleStatusChange,
  scheduleWordActivity,
} from "../_lib/projectStats";
import { getRateLimitKey, rateLimiter } from "../_lib/rateLimits";
import { countWords } from "../_lib/wordCount";
import {
  buildExcerpt,
  CONTENT_SEARCH_LIMIT,
  extractSnippet,
  MIN_CONTENT_TERM,
  readContent,
  readContentById,
  writeContent,
} from "./_lib/documentContent";
import { syncDocumentLinks } from "./_lib/documentLinks";

/** Full `documents` row shape — mirrors `convex/schema.ts`. Shared by every
 *  function returning whole documents (same pattern as
 *  `convex/social/credentialsDb.ts` CREDENTIAL_DOC). */
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
  createdAt: v.number(),
  updatedAt: v.number(),
};

const DOCUMENT_DOC = v.object(documentFields);

/** `documents` row with the body joined back from `document_content`. */
const DOCUMENT_DOC_WITH_CONTENT = v.object({
  ...documentFields,
  content: v.string(),
});

/**
 * Verifies that a document exists and that the given user owns the parent project.
 * Follows the chain: document -> project -> project.userId === userId.
 * Returns the document if ownership is confirmed; throws otherwise.
 */
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

/**
 * Lists documents within a project, optionally filtered by status.
 * Uses the compound index `by_projectId_and_status` when a status filter is
 * provided for efficient querying, falling back to `by_projectId` otherwise.
 * Returns an empty array for unauthenticated or unauthorized users.
 *
 * @param args.projectId - The project whose documents to list.
 * @param args.status - Optional filter: "draft", "scheduled", or "published".
 * @returns Documents sorted by most recently updated.
 */
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
      // No status+trashedAt compound index — keep the in-memory trash
      // filter but query a larger window so trash doesn't crowd out active
      // status-matched docs.
      const status = args.status;
      const raw = await ctx.db
        .query("documents")
        .withIndex("by_projectId_and_status", (q) =>
          q.eq("projectId", args.projectId).eq("status", status),
        )
        .take(2000);
      documents = raw.filter((d) => d.trashedAt === undefined);
    } else {
      // Use the trashedAt-aware index so trashed docs never enter the
      // candidate set and steal slots from active ones.
      documents = await ctx.db
        .query("documents")
        .withIndex("by_projectId_and_trashedAt", (q) =>
          q.eq("projectId", args.projectId).eq("trashedAt", undefined),
        )
        .take(500);
    }

    // The body lives in `document_content` now, so this hot reactive
    // subscription never reads an article body — `wordCount` and `excerpt`
    // are denormalized on the document row and maintained on every content
    // write.
    return documents
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .map((d) => ({
        ...d,
        wordCount: d.wordCount ?? 0,
        excerpt: d.excerpt ?? "",
      }));
  },
});

/**
 * Paginated lean listing for the editor's `[[` internal-link menu —
 * id/title/slug only, newest first, trash excluded via the composite
 * index. The menu pulls a handful of rows at a time as the user scrolls,
 * so a project with hundreds of posts never ships its whole list at once.
 */
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

/**
 * Title typeahead for the `[[` internal-link menu, backed by the
 * `search_title` index. Bounded result set; trash filtered post-take.
 */
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

/**
 * Title search for MCP clients (`wryte_documents_search`), scoped to one
 * project or across every project the caller owns.
 *
 * Backed by the `search_title` index that already exists for the editor's
 * `[[` link menu, so this adds a query, not an index. It is **title-only** by
 * design: body search costs a full-body read per hit, so it lives in
 * `searchContent` behind the palette's explicit, debounced, capped path rather
 * than on an agent tool that might call it in a loop.
 *
 * Both paths filter *inside* the index — by `projectId` when scoped, by
 * `userId` otherwise — so a search is a single indexed read and no other
 * tenant's titles are ever loaded into memory.
 */
export const search = query({
  args: {
    term: v.string(),
    projectId: v.optional(v.id("projects")),
    limit: v.optional(v.number()),
  },
  returns: v.object({
    results: v.array(
      v.object({
        _id: v.id("documents"),
        projectId: v.id("projects"),
        projectName: v.string(),
        title: v.string(),
        slug: v.string(),
        status: v.string(),
        updatedAt: v.number(),
        wordCount: v.optional(v.number()),
      }),
    ),
  }),
  handler: async (ctx, args) => {
    const user = await getAuthedUserOrNull(ctx);
    if (!user) return { results: [] };
    return await searchDocumentsForUser(ctx, user._id, args);
  },
});

/** `search`'s body with the actor passed in explicitly. */
export async function searchDocumentsForUser(
  ctx: QueryCtx,
  userId: Id<"users">,
  args: { term: string; projectId?: Id<"projects">; limit?: number },
) {
  const empty = { results: [] };
  const term = args.term.trim();
  if (!term) return empty;

  const limit = Math.min(Math.max(args.limit ?? 20, 1), 50);

  // Scoped searches verify ownership up front; unscoped ones are scoped by the
  // index's own `userId` filter, which is the same guarantee without reading
  // every project row to get it.
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

  // `projectName` is part of this response's contract (MCP clients show it),
  // so resolve each distinct parent once — hits cluster into a handful of
  // projects, which is far cheaper than the owned-projects scan the old
  // per-project fan-out needed just to build its name map.
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

/**
 * Body full-text search behind the command palette's "In content" section —
 * the one path that deliberately opts back into reading article bodies.
 *
 * `document_content` is a separate table precisely so the list/board/calendar
 * queries never read bodies; this query reads them because the user explicitly
 * typed prose, and it is debounced, gated on a minimum term length, and capped
 * at `CONTENT_SEARCH_LIMIT` hits so that cost stays bounded and per-intent.
 *
 * `userId` is filtered inside the search index, so another tenant's body is
 * never loaded into memory. Results stay in the index's relevance order —
 * re-sorting by date here would throw away the BM25 ranking that makes a body
 * search useful.
 */
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

    // Snippets are cut here, before anything is returned, so bodies stay
    // local to this function — only ~200 characters per hit cross the wire.
    // No project name is resolved: the palette row shows the snippet instead,
    // and `projects` rows are large enough that reading eight of them for a
    // label nobody displays would be the most expensive part of the query.
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

/**
 * Paginated full-content feed for the one-shot project export in
 * settings. Unlike `list` this DOES ship content + frontmatter — callers
 * walk pages imperatively (no reactive subscription), so the payload is
 * only ever paid when the user clicks Export.
 */
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

/**
 * Documents for the on-demand link checker action — ownership verified
 * via tokenIdentifier since actions can't touch the DB directly.
 */
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

/** Returns the N most recently updated documents, optionally scoped to a project. */
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

    const documents = pid
      ? await ctx.db
          .query("documents")
          .withIndex("by_projectId_and_trashedAt", (q) =>
            q.eq("projectId", pid).eq("trashedAt", undefined),
          )
          .take(200)
      : await ctx.db
          .query("documents")
          .withIndex("by_userId", (q) => q.eq("userId", user._id))
          .take(200);

    // Metadata projection — consumers (command palette, dashboard recents) only
    // render title/status/time, so never ship the full `content` blob (this
    // reads up to 200 docs and would otherwise serialize all their bodies).
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

/**
 * Lightweight catalog of every non-trashed document the user owns, across
 * all projects — powers the command palette's client-side fuzzy search.
 *
 * One subscription replaces per-keystroke server searches: the client
 * matches locally, so typing in the palette never costs a function call.
 * Metadata projection only (~100 bytes/row), never bodies or excerpts.
 */
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

    // ponytail: hard cap at 1000 rows — at ~100 bytes each that's a 100 KB
    // read. Paginate or move to a server-side search index if a library
    // ever outgrows this.
    const documents = await ctx.db
      .query("documents")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
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

/**
 * Fetches a single document by ID with full ownership verification.
 *
 * @requires Authentication + document ownership (via parent project)
 * @param args.documentId - The document to retrieve.
 * @returns The document record.
 */
export const get = query({
  args: { documentId: v.id("documents") },
  returns: v.union(v.null(), DOCUMENT_DOC_WITH_CONTENT),
  handler: async (ctx, args) => {
    const user = await getAuthedUserOrNull(ctx);
    if (!user) {
      throw new Error("Not authenticated");
    }
    // Joins the body back from `document_content` so every existing consumer
    // of `get` (editor, AI synthesis, draft tabs, frontmatter editor) keeps
    // receiving `document.content` unchanged. Single-document read — it does
    // NOT reintroduce the list-query read amplification this migration removed.
    //
    // NOTE: because the content row is a read-dependency, a LIVE subscription
    // to this query re-runs (and re-sends the full body) on every autosave
    // tick. Always-mounted UI must subscribe to `getMeta` instead and fetch the
    // body one-shot — see `getMeta` below.
    return await documentWithContentForUser(ctx, user._id, args.documentId);
  },
});

/**
 * `get`'s ownership check and body join, with the actor passed in explicitly.
 *
 * Shared with the MCP handler, which cannot use `ctx.auth`: the gateway
 * dispatches tools from inside its component, where Convex does not propagate
 * identity. See `_lib/auth.ts → requireCaller`.
 */
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

/** `getBySlug`'s body with the actor passed in explicitly. */
async function documentBySlugForUser(
  ctx: QueryCtx,
  userId: Id<"users">,
  projectId: Id<"projects">,
  slug: string,
) {
  const project = await ctx.db.get(projectId);
  if (!project || project.userId !== userId) return null;

  const matches = await ctx.db
    .query("documents")
    .withIndex("by_projectId_and_slug", (q) =>
      q.eq("projectId", projectId).eq("slug", slug),
    )
    .take(10);

  const match = matches.find((d) => d.trashedAt === undefined);
  if (!match) return null;
  const content = await readContent(ctx, match);
  return { ...match, content };
}

/** `listForLink`'s body with the actor passed in explicitly. */
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

/**
 * Metadata-only variant of {@link get} — same ownership/trash rules, but
 * never reads the `document_content` row, so it does NOT re-run (or
 * re-bill) when autosave writes the body. This is the subscription for
 * always-mounted chrome (app header, draft tab bar, editor shell) that
 * renders title/status/etc. but never the body — mirroring how
 * `documentDrafts.list` deliberately excludes draft bodies.
 */
export const getMeta = query({
  args: { documentId: v.id("documents") },
  returns: v.union(v.null(), DOCUMENT_DOC),
  handler: async (ctx, args) => {
    const user = await getAuthedUserOrNull(ctx);
    if (!user) {
      throw new Error("Not authenticated");
    }
    const document = await verifyDocumentOwnership(
      ctx,
      args.documentId,
      user._id,
    );
    if (document.trashedAt !== undefined) {
      return null;
    }
    return document;
  },
});

/**
 * "What links here" — the source documents whose MAIN body contains a
 * resolved `[[wiki link]]` to `documentId`. Powers the editor research
 * panel's "Linked from" section.
 *
 * Reads the target's edges via `by_targetDocumentId` (bounded `.take(50)`),
 * then hydrates each source's metadata row (title/status/updatedAt) with a
 * single `ctx.db.get` per edge — metadata-only, no body reads, bounded 50.
 * Returns `[]` (never throws) for unauthenticated / unauthorized callers so
 * the panel degrades quietly.
 */
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

/** `getBacklinks`'s body with the actor passed in explicitly. */
export async function backlinksForUser(
  ctx: QueryCtx,
  userId: Id<"users">,
  documentId: Id<"documents">,
) {
  {
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
      // Skip dangling edges and trashed sources — a trashed document
      // shouldn't advertise itself as linking here.
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
}

/**
 * Creates a new blank document in draft status within the specified project.
 * Verifies the user owns the target project before inserting.
 *
 * @requires Authentication + project ownership
 * @param args.projectId - The project to add the document to.
 * @param args.title - Document title.
 * @param args.slug - URL-safe identifier used as the filename when publishing.
 * @returns The new document's ID.
 */
export const create = mutation({
  args: {
    projectId: v.id("projects"),
    title: v.string(),
    slug: v.string(),
    status: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
    frontmatter: v.optional(v.string()),
    /** Optional body content for imported .md/.mdx files. */
    content: v.optional(v.string()),
  },
  returns: v.id("documents"),
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    return await createDocumentForUser(ctx, user, args);
  },
});

/**
 * `create`'s body with the actor passed in explicitly.
 *
 * Shared by the public mutation (actor from `ctx.auth`) and the MCP handler
 * (actor injected by the gateway — component-dispatched tools have no
 * `ctx.auth`; see `_lib/auth.ts → requireCaller`).
 *
 * The rate-limit key comes from `user.tokenIdentifier` rather than
 * `getRateLimitKey(ctx)`. Same value on the web path, but it also fixes a bug
 * the MCP path would otherwise have: `getRateLimitKey` reads `ctx.auth`, which
 * is null under component dispatch, so it returns the literal `"anonymous"` —
 * collapsing every MCP user's writes into one shared global bucket.
 */
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
    // The body starts empty and lives in `document_content`; we don't
    // create a content row until the first save (an absent row reads as
    // "" via the documentContent helper) — unless content was provided
    // via file import.
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

    // If content was provided (file import), create the content row immediately.
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

/**
 * Partially updates a document's content, metadata, or status.
 * Only fields that are explicitly provided are written; `updatedAt` is always refreshed.
 *
 * @requires Authentication + document ownership
 * @param args.documentId - The document to update.
 */
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

/**
 * `update`'s body with the actor passed in explicitly. Shared with the MCP
 * handler, which has no `ctx.auth` — see `_lib/auth.ts → requireCaller`.
 *
 * Rate-limit key comes from `user.tokenIdentifier`, not `getRateLimitKey(ctx)`:
 * identical on the web path, but `getRateLimitKey` reads `ctx.auth` and would
 * return the literal `"anonymous"` under component dispatch, collapsing every
 * MCP user into one shared bucket.
 */
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
  {
    await rateLimiter.limit(ctx, "documents:update", {
      key: user.tokenIdentifier,
      throws: true,
    });

    const document = await verifyDocumentOwnership(
      ctx,
      args.documentId,
      user._id,
    );

    // Status transitions that require side-effects (workflow scheduling /
    // cancellation, publish history, social cross-post) must go through
    // their dedicated APIs. Direct writes here would leave the workflow
    // queue out of sync with the document's apparent state — e.g. a doc
    // could appear scheduled with no firing workflow, or appear published
    // with no publish_history row.
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
      // Convex serializes documents as UTF-8 and enforces a 1MB per-document
      // ceiling. A `.length` check would be off by ~3× for CJK or emoji-
      // heavy content (UTF-16 code units vs UTF-8 bytes), so compute the
      // real byte size before comparing to the cap.
      const byteLength = new TextEncoder().encode(args.content).byteLength;
      if (byteLength > MAX_CONTENT_BYTES) {
        throw new Error(
          `Document content is too large (max ${String(Math.round(MAX_CONTENT_BYTES / 1024))} KB).`,
        );
      }
    }

    // Defense-in-depth lock: if the doc has an unresolved sync
    // conflict, edits are not allowed. The editor UI also blocks the
    // flow, but autosave fires from background timers and stale tabs,
    // so we re-check here to keep the divergence from compounding. The
    // `by_documentId_unresolved` index reads only OPEN conflicts (normally
    // zero rows) instead of paging through resolved audit history.
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

    // `content` is handled separately (it lives in `document_content`); every
    // other provided field is a plain metadata patch.
    for (const [key, value] of Object.entries(updates)) {
      if (value !== undefined) {
        fieldsToUpdate[key] = value;
      }
    }

    let wordCountDelta = 0;
    if (content !== undefined) {
      const newWordCount = countWords(content);
      fieldsToUpdate["wordCount"] = newWordCount;
      fieldsToUpdate["excerpt"] = buildExcerpt(content);
      wordCountDelta = newWordCount - (document.wordCount ?? 0);
      // Pass the denormalized pointer so `writeContent` patches the body
      // row directly instead of re-reading it first. This `update` path
      // already patches the `documents` row every call, so when the pointer
      // isn't set yet we fold the returned id into that same patch — no
      // extra write.
      const contentId = await writeContent(ctx, {
        documentId,
        projectId: document.projectId,
        userId: user._id,
        content,
        ...(document.contentId ? { contentId: document.contentId } : {}),
      });
      // Persist when missing OR stale — a stale pointer self-heals inside
      // `writeContent`, but if it's never written back every future
      // autosave pays the full-body index read.
      if (document.contentId !== contentId) {
        fieldsToUpdate["contentId"] = contentId;
      }
    }

    await ctx.db.patch(documentId, fieldsToUpdate);

    // Flush-path only: recompute the backlink graph when the MAIN body was
    // provided (manual save / metadata flush). Deliberately absent from
    // `autosaveBody` so link resolution never rides the 3s hot path.
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
}

/**
 * Hot-path autosave: persists ONLY the document body to `document_content`.
 *
 * Deliberately does NOT touch the `documents` row (no `updatedAt`,
 * `wordCount`, `excerpt`, or word-activity write) when only the body
 * changes. The board/sidebar `list` subscriptions read the `documents`
 * row, so bumping it on every keystroke-batch would force the
 * always-mounted sidebar to re-read the whole project list every few
 * seconds — the dominant remaining database-bandwidth cost during a
 * writing session. The row's derived metadata is refreshed on a coarser
 * cadence (manual save, leaving the editor, status/publish) via `update`.
 *
 * Title is the one field shown in those lists, so a genuine title change
 * is reflected immediately — but that's rare, so it doesn't reintroduce
 * per-keystroke invalidation.
 */
export const autosaveBody = mutation({
  args: {
    documentId: v.id("documents"),
    content: v.string(),
    title: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const key = await getRateLimitKey(ctx);
    await rateLimiter.limit(ctx, "documents:update", { key, throws: true });

    const user = await getCurrentUser(ctx);
    const document = await verifyDocumentOwnership(
      ctx,
      args.documentId,
      user._id,
    );

    const byteLength = new TextEncoder().encode(args.content).byteLength;
    if (byteLength > MAX_CONTENT_BYTES) {
      throw new Error(
        `Document content is too large (max ${String(Math.round(MAX_CONTENT_BYTES / 1024))} KB).`,
      );
    }

    // Same defense-in-depth conflict lock as `update`: background autosave
    // timers must not write over a document with a pending sync conflict.
    // Reads only OPEN conflicts via `by_documentId_unresolved` (normally
    // zero rows) so this per-tick guard never pages resolved history.
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

    // Hot path: patch the body row directly via the denormalized pointer so
    // Convex doesn't bill an N-byte read-before-write on every tick. We
    // deliberately DON'T persist the pointer back onto `documents` when it's
    // missing — that would dirty the row and invalidate the always-mounted
    // list subscriptions. The migration backfills `contentId`; until then
    // this path self-heals through `writeContent`'s index fallback.
    await writeContent(ctx, {
      documentId: args.documentId,
      projectId: document.projectId,
      userId: user._id,
      content: args.content,
      ...(document.contentId ? { contentId: document.contentId } : {}),
    });

    // Only touch the hot `documents` row when the title actually changed.
    if (args.title !== undefined && args.title !== document.title) {
      await ctx.db.patch(args.documentId, {
        title: args.title,
        updatedAt: Date.now(),
      });
    }
    return null;
  },
});

/** Soft upper bound on document `content` length. Convex's 1MB doc limit
 *  is the hard ceiling — we keep things well below it so other fields
 *  retain budget and the UI doesn't have to deal with cryptic Convex
 *  errors from an oversize patch. */
const MAX_CONTENT_BYTES = 500 * 1024;

/**
 * Creates a duplicate of an existing document in the same project.
 * Copies content, frontmatter, tags, and status but generates a new slug.
 *
 * @requires Authentication + document ownership
 * @param args.documentId - The document to duplicate.
 * @returns The new document's ID.
 */
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

/** `duplicate`'s body with the actor passed in explicitly. */
async function duplicateDocumentForUser(
  ctx: MutationCtx,
  user: Doc<"users">,
  args: { documentId: Id<"documents"> },
): Promise<{ documentId: Id<"documents">; title: string }> {
  {
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
    // Persist the pointer at creation time (cheap — the row was just
    // inserted) so future autosaves skip the read-before-write.
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
}

/**
 * Transitions a document's status. When transitioning to "published",
 * `publishedAt` is automatically set to the current timestamp.
 *
 * @requires Authentication + document ownership
 * @param args.documentId - The document to update.
 * @param args.status - The new status: "draft", "scheduled", or "published".
 */
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

/** `updateStatus`'s body with the actor passed in explicitly. Shared with the
 *  MCP handler, which has no `ctx.auth` — see `_lib/auth.ts → requireCaller`. */
async function updateStatusForUser(
  ctx: MutationCtx,
  user: Doc<"users">,
  args: ObjectType<typeof updateStatusArgs>,
): Promise<null> {
  {
    await rateLimiter.limit(ctx, "documents:updateStatus", {
      key: user.tokenIdentifier,
      throws: true,
    });

    const doc = await verifyDocumentOwnership(ctx, args.documentId, user._id);

    const now = Date.now();
    const updates: Record<string, unknown> = {
      status: args.status,
      updatedAt: now,
    };

    if (args.status === "published") {
      updates["publishedAt"] = now;
    }

    if (doc.status === "scheduled" && args.status !== "scheduled") {
      updates["scheduledAt"] = undefined;
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
}

/**
 * Soft-deletes a document by setting `trashedAt` and cancelling any
 * pending scheduled publishes. The doc disappears from every
 * user-facing query and surfaces in the project trash instead, where
 * the user can restore it or hard-delete. A daily cron drains items
 * older than the project's `trashRetentionDays` (default 30) — see
 * `convex/cms/trash.ts:_cleanupExpired`.
 *
 * Cancelling scheduled publishes prevents the workflow from firing
 * against a soft-deleted target. Users re-schedule manually on
 * restore.
 *
 * @requires Authentication + document ownership
 */
export const remove = mutation({
  args: { documentId: v.id("documents") },
  returns: v.null(),
  handler: async (ctx, args) =>
    await trashDocumentForUser(ctx, await getCurrentUser(ctx), args),
});

/** `remove`'s body (soft delete) with the actor passed in explicitly. */
export async function trashDocumentForUser(
  ctx: MutationCtx,
  user: Doc<"users">,
  args: { documentId: Id<"documents"> },
): Promise<null> {
  {
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
}

/**
 * Imports a markdown file from GitHub into the project as a published document.
 * Uses `githubPath` for duplicate detection: if a document with the same GitHub
 * file path already exists in the project, it returns the existing document's ID
 * instead of creating a duplicate. This makes the import idempotent — safe to
 * retry or call multiple times for the same file.
 *
 * @requires Authentication + project ownership
 * @param args.githubPath - The file path in the repo, used as the dedup key.
 * @param args.githubSha - The Git blob SHA, used for future update detection.
 * @returns The document ID (existing or newly created).
 */
export const importFromGithub = mutation({
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
  handler: async (ctx, args) => {
    const key = await getRateLimitKey(ctx);
    await rateLimiter.limit(ctx, "documents:importFromGithub", {
      key,
      throws: true,
    });

    const user = await getCurrentUser(ctx);

    const project = await ctx.db.get(args.projectId);
    if (!project) {
      throw new Error("Project not found");
    }
    if (project.userId !== user._id) {
      throw new Error("Unauthorized: you do not own this project");
    }

    // Dedup by (projectId, githubPath) so re-importing the same file is a
    // no-op. Indexed lookup — O(log n), not O(n) over the whole project.
    const duplicate = await ctx.db
      .query("documents")
      .withIndex("by_projectId_and_githubPath", (q) =>
        q.eq("projectId", args.projectId).eq("githubPath", args.githubPath),
      )
      .unique();
    if (duplicate) {
      return duplicate._id;
    }

    const now = Date.now();

    const wc = countWords(args.content);
    const documentId = await ctx.db.insert("documents", {
      projectId: args.projectId,
      userId: user._id,
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
      documentId,
      projectId: args.projectId,
      userId: user._id,
      content: args.content,
    });
    // Stamp the pointer at creation so later edits skip the read-before-write.
    await ctx.db.patch(documentId, { contentId });
    await adjustDocumentCount(ctx, args.projectId, 1);
    await scheduleWordActivity(ctx, {
      userId: user._id,
      projectId: args.projectId,
      wordCountDelta: wc,
    });
    await scheduleStatusChange(ctx, {
      projectId: args.projectId,
      userId: user._id,
      oldStatus: null,
      newStatus: "published",
    });
    return documentId;
  },
});

/**
 * Auth-skipped internal twin of `importFromGithub` for the bulk-import
 * workpool job (`convex/github.ts:_importOneFromGithubJob`). The job has
 * no user session — the parent `startBulkImport` action already verified
 * project ownership before enqueuing, so this mutation just trusts its
 * caller and gets out of the way. Same dedup-by-githubPath behaviour.
 */
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

    // Idempotent dedup — re-running the same file path is a no-op so
    // workpool retries don't duplicate documents. Indexed lookup so a
    // project with 10k+ docs doesn't melt under bulk-import retries.
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
    // Stamp the pointer at creation so later edits skip the read-before-write.
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

/**
 * Looks up a document by its slug within a project. Returns null for
 * unauthenticated/unauthorized users rather than throwing, so the client
 * can handle missing documents gracefully.
 *
 * @param args.projectId - The project to search within.
 * @param args.slug - The document slug to find.
 * @returns The matching document, or null.
 */
export const getBySlug = query({
  args: {
    projectId: v.id("projects"),
    slug: v.string(),
  },
  returns: v.union(v.null(), DOCUMENT_DOC_WITH_CONTENT),
  handler: async (ctx, args) => {
    const user = await getAuthedUserOrNull(ctx);
    if (!user) return null;

    // O(log n) lookup on the exact slug via `by_projectId_and_slug` instead
    // of scanning up to 2000 metadata rows. Slugs aren't unique across the
    // active/trashed split (a soft-deleted doc can share a slug with its
    // replacement), so trash is filtered among the handful of exact matches
    // and the body joined back only for the winner.
    return await documentBySlugForUser(
      ctx,
      user._id,
      args.projectId,
      args.slug,
    );
  },
});

/**
 * Toggles the bookmarked flag on a document.
 * If the document is currently bookmarked it becomes un-bookmarked, and vice versa.
 *
 * @requires Authentication + document ownership
 * @param args.documentId - The document to toggle.
 * @returns The new bookmarked state.
 */
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

/**
 * Internal-only query to fetch a document by ID without auth checks.
 * Used by server-side actions that have already verified access.
 */
export const internalGet = internalQuery({
  args: { documentId: v.id("documents") },
  returns: v.union(v.null(), DOCUMENT_DOC_WITH_CONTENT),
  handler: async (ctx, args) => {
    const document = await ctx.db.get(args.documentId);
    if (!document) return null;
    // Join the body back so server-side action callers (GitHub publish,
    // bulk publish) keep seeing `document.content` without each having to
    // know about the `document_content` table.
    const content = await readContent(ctx, document);
    return { ...document, content };
  },
});

/**
 * Pre-flight check for bulk delete: returns only those documents whose
 * ID is in `ids` AND whose `projectId` matches. `startBulkDelete`
 * compares `result.length` to `ids.length` to detect cross-project ids
 * before enqueuing N workpool jobs that would silently no-op.
 */
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

/**
 * Internal mutation to update document content.
 * Used by the publish action to rewrite Convex media URLs to GitHub paths.
 */
export const internalUpdate = internalMutation({
  args: {
    documentId: v.id("documents"),
    content: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const doc = await ctx.db.get(args.documentId);
    if (!doc) throw new Error("Document not found");
    const contentId = await writeContent(ctx, {
      documentId: args.documentId,
      projectId: doc.projectId,
      userId: doc.userId,
      content: args.content,
      ...(doc.contentId ? { contentId: doc.contentId } : {}),
    });
    const patch: Record<string, unknown> = {
      excerpt: buildExcerpt(args.content),
      updatedAt: Date.now(),
    };
    // Fold the pointer into this row's existing patch when it wasn't set yet.
    if (doc.contentId === undefined) {
      patch["contentId"] = contentId;
    }
    await ctx.db.patch(args.documentId, patch);
    return null;
  },
});

/**
 * Internal mutation called after a successful GitHub publish to record
 * the resulting file path, SHA, and publication timestamp on the document.
 * Keeping this separate from the GitHub action allows the action to remain
 * stateless while the mutation handles the database write transactionally.
 */
/**
 * Moves a board card to a new column and position.
 * Used by the kanban board's drag-and-drop handler to update a document's
 * status and ordering in a single atomic operation.
 *
 * Returns the target column's behavior so the client knows whether to
 * trigger publish or schedule flows.
 */
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

    // Convex's v.number() accepts NaN and ±Infinity. Clamp to a safe range
    // so downstream sort / render code doesn't break.
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

    const updates: Record<string, unknown> = {
      status: args.targetStatus,
      boardPosition: clampedPosition,
      updatedAt: Date.now(),
    };

    // Check if the target column has special behavior
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
            updates["publishedAt"] = Date.now();
          }
        }
      } catch {
        // Invalid board columns JSON, fall through
      }
    } else {
      // No custom columns — use default behavior mapping
      if (args.targetStatus === "published") {
        updates["publishedAt"] = Date.now();
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

/**
 * Updates the tags on a document, keeping both the denormalized `tags` array
 * and the `frontmatter` JSON string in sync.
 */
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

/** `updateTags`'s body with the actor passed in explicitly. */
async function updateTagsForUser(
  ctx: MutationCtx,
  user: Doc<"users">,
  args: ObjectType<typeof updateTagsArgs>,
): Promise<null> {
  {
    await rateLimiter.limit(ctx, "documents:updateTags", {
      key: user.tokenIdentifier,
      throws: true,
    });

    await verifyDocumentOwnership(ctx, args.documentId, user._id);

    const doc = await ctx.db.get(args.documentId);

    // Update tags in frontmatter JSON to keep in sync
    let frontmatter: Record<string, unknown> = {};
    if (doc?.frontmatter) {
      try {
        frontmatter = JSON.parse(doc.frontmatter);
      } catch {
        // Invalid JSON, start fresh
      }
    }
    frontmatter["tags"] = args.tags;

    await ctx.db.patch(args.documentId, {
      tags: args.tags,
      frontmatter: JSON.stringify(frontmatter),
      updatedAt: Date.now(),
    });
    return null;
  }
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
    const patch: Record<string, unknown> = {
      githubPath: args.githubPath,
      githubSyncedAt: Date.now(),
      status: args.status,
      publishedAt: args.publishedAt,
      updatedAt: Date.now(),
    };
    if (args.githubSha !== undefined) {
      patch["githubSha"] = args.githubSha;
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

/* ------------------------------------------------------------------ */
/*  Publish history                                                    */
/* ------------------------------------------------------------------ */

/**
 * Records a publish event in the history table.
 * Called internally after every successful GitHub publish.
 */
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
    // Body + frontmatter live in the sibling `publish_history_content` table
    // so `getPublishHistory` (the History panel list, up to 100 rows) never
    // reads full publish bodies. The metadata row keeps only the small,
    // list-rendered fields.
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

    // Prune to the newest 50 publishes per document. Read one page past the
    // cap (desc) and delete the overflow — both the metadata row and its
    // content row. Overflow rows may be legacy (body inline on the metadata
    // row, no content row) or new (body in `publish_history_content`); the
    // `by_publishId` lookup returns nothing for the former, so both shapes
    // are handled.
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

/**
 * Returns the publish history for a document, newest first. Metadata-only
 * projection — bodies live in `publish_history_content` and are read on
 * demand by `rollbackToVersion`, so opening the History panel never pulls
 * up to 100 full publish bodies.
 */
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

/** `getPublishHistory`'s body with the actor passed in explicitly. */
export async function publishHistoryForUser(
  ctx: QueryCtx,
  userId: Id<"users">,
  documentId: Id<"documents">,
) {
  {
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
}

const PUBLISH_SNAPSHOT = v.object({
  content: v.string(),
  frontmatter: v.optional(v.string()),
  titleSnapshot: v.string(),
  commitSha: v.string(),
  createdAt: v.number(),
});

/**
 * Content snapshots for a publish-vs-previous-publish diff, read only when
 * a diff sheet opens (never by the History list). `previous` is null for
 * the first publish — the sheet renders that as "everything added". A
 * missing content row (legacy pre-sidecar publishes) returns null overall.
 */
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

    // The publish immediately before this one (history is capped at 50, so
    // one page covers everything retained).
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

/**
 * Rolls back a document to a previous published version.
 * Restores title, content, and frontmatter from the history snapshot.
 */
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

/** `rollbackToVersion`'s body with the actor passed in explicitly. */
async function rollbackDocumentForUser(
  ctx: MutationCtx,
  user: Doc<"users">,
  args: { documentId: Id<"documents">; historyId: Id<"publish_history"> },
) {
  {
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

    // Body + frontmatter live in `publish_history_content`.
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
    const patch: Record<string, unknown> = {
      title: historyEntry.titleSnapshot,
      excerpt: buildExcerpt(content),
      wordCount: countWords(content),
      frontmatter,
      updatedAt: Date.now(),
    };
    if (document.contentId === undefined) {
      patch["contentId"] = newContentId;
    }
    await ctx.db.patch(args.documentId, patch);

    return {
      title: historyEntry.titleSnapshot,
      restoredFrom: historyEntry.createdAt,
    };
  }
}

/**
 * Lightweight query for the content calendar view.
 *
 * Returns all documents for a project with only the fields needed for
 * calendar rendering (no content/frontmatter), keeping the payload small.
 */
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

/** `listForCalendar`'s body with the actor passed in explicitly. */
export async function calendarForUser(
  ctx: QueryCtx,
  userId: Id<"users">,
  projectId: Id<"projects">,
) {
  {
    const project = await ctx.db.get(projectId);
    if (!project || project.userId !== userId) return [];

    const documents = await ctx.db
      .query("documents")
      .withIndex("by_projectId_and_trashedAt", (q) =>
        q.eq("projectId", projectId).eq("trashedAt", undefined),
      )
      .take(500);

    return documents.map((d) => ({
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
}

/**
 * Cross-project calendar feed — one lean row per dated document across all
 * of the user's projects. Only documents with a `scheduledAt` or
 * `publishedAt` are returned (the global calendar has no unscheduled
 * panel), so the payload stays proportional to the writing cadence, not
 * the archive size.
 *
 * Bounds: 25 projects × 300 docs read worst-case (well inside transaction
 * limits); mounted only while /calendar is open — no standing cost.
 */
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

/** `listForCalendarAllProjects`'s body with the actor passed in explicitly. */
async function allProjectsCalendarForUser(ctx: QueryCtx, userId: Id<"users">) {
  {
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
          ...(d.scheduledAt !== undefined
            ? { scheduledAt: d.scheduledAt }
            : {}),
          ...(d.publishedAt !== undefined
            ? { publishedAt: d.publishedAt }
            : {}),
        });
      }
    }
    return rows;
  }
}

/**
 * Stale-content radar: published documents that haven't been touched in
 * `olderThanMonths` (default 6). Bounded index read + in-memory filter —
 * no cron, no extra table; subscribed only while the project overview is
 * on screen. Returns the 10 stalest, oldest first.
 */
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

/** `listStale`'s body with the actor passed in explicitly. Shared with the MCP
 *  handler, which has no `ctx.auth` — see `_lib/auth.ts → requireCaller`. */
async function staleDocumentsForUser(
  ctx: QueryCtx,
  userId: Id<"users">,
  args: { projectId: Id<"projects">; olderThanMonths?: number },
) {
  {
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
}

/* ------------------------------------------------------------------ */
/*  Bulk import — tracking, progress, and workpool callback             */
/* ------------------------------------------------------------------ */

/**
 * Creates the `import_batches` row that `convex/github.ts:startBulkImport`
 * uses to track progress. Internal-only because the caller has already
 * resolved auth + ownership in the parent action.
 */
export const _createImportBatch = internalMutation({
  args: {
    projectId: v.id("projects"),
    userId: v.id("users"),
    total: v.number(),
  },
  returns: v.id("import_batches"),
  handler: async (ctx, args): Promise<Id<"import_batches">> => {
    const now = Date.now();
    // Counts (`succeeded`, `failed`, `errors`) are now derived from
    // `import_job_outcomes` to avoid OCC contention — leaving them off
    // the new row entirely. The schema keeps them optional for legacy
    // rows.
    return await ctx.db.insert("import_batches", {
      projectId: args.projectId,
      userId: args.userId,
      total: args.total,
      createdAt: now,
      updatedAt: now,
    });
  },
});

/**
 * Workpool `onComplete` callback for the GitHub bulk-import pool. Runs
 * once per finished job — succeeded, failed, or canceled.
 *
 * Each callback inserts a brand-new `import_job_outcomes` row instead
 * of patching the parent batch. That eliminates the OCC hotspot that
 * comes from N parallel callbacks fighting over a single row's counters
 * — see https://docs.convex.dev/error#1. The `getImportBatch` query
 * aggregates outcomes to compute live succeeded/failed/errors.
 */
export const _onImportFileComplete = internalMutation({
  args: {
    workId: v.string(),
    context: v.any(),
    result: v.any(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { batchId, filePath } = args.context as {
      batchId: Id<"import_batches">;
      filePath: string;
    };
    const result = args.result as
      | { kind: "success"; returnValue: unknown }
      | { kind: "failed"; error: string }
      | { kind: "canceled" };

    // Defense in depth: if the batch row is gone (manually cleaned up
    // before workpool drained), don't leave orphaned outcomes.
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

/**
 * Reactive read for the import progress UI. Returns the batch row
 * enriched with aggregated `succeeded` / `failed` / `errors` derived
 * from `import_job_outcomes` (which is contention-free — every job
 * inserts its own row). Returns null if the caller doesn't own the
 * batch's project.
 *
 * Note on cost: this aggregates by `collect()`-ing every outcome row
 * for the batch on each read. For our max batch size (200 files) that's
 * fine. If batch sizes grow, replace with the `@convex-dev/aggregate`
 * component which maintains running counters lock-free.
 */
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

/* ------------------------------------------------------------------ */
/*  Bulk delete — tracking, progress, and workpool callback             */
/* ------------------------------------------------------------------ */

/**
 * Auth-skipped internal version of `remove` for the bulk-delete workpool
 * job. The job has no user session — the parent `startBulkDelete` action
 * verified the user owns `projectId` before enqueuing.
 *
 * **Project-bound for defense in depth.** Even though the parent action
 * validates ownership of `projectId`, an internal action could in
 * principle be called with a `documentId` that belongs to *another*
 * project (e.g. a future bug, a malicious refactor, or a forged caller).
 * We re-verify here that `doc.projectId === args.projectId` and
 * no-op silently if not. Combined with `startBulkDelete`'s pre-flight
 * filter, this means cross-project deletion is impossible by
 * construction.
 *
 * Preserves the cascade to `scheduled_publishes` via
 * `cascadeDeleteScheduledPublishesForDoc` so no orphaned workflow jobs
 * fire against a deleted doc.
 */
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
      // Refuse to act on docs outside the scope the caller verified.
      // Silent return rather than throw — callers loop over many docs
      // and one bad id shouldn't halt the whole batch.
      return null;
    }
    if (doc.trashedAt !== undefined) {
      // Already trashed — idempotent no-op so retries don't error.
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

/**
 * Bulk soft-delete for "local only" mode in `startBulkDelete`. Skips
 * the workpool entirely — a 50-doc local delete now takes one
 * function call instead of ~250. Caps the batch at 50 ids per call
 * so the mutation stays comfortably under Convex's per-transaction
 * limits; the action layer iterates if more were requested.
 *
 * The caller has already verified that `args.documentIds` all belong
 * to `args.projectId`; we still check each doc defensively so a stale
 * id can't slip past.
 */
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

/**
 * Removes every `scheduled_publishes` row pointing at a document so
 * workflow jobs don't fire against a deleted target. Used by the
 * single-doc `remove` mutation, the bulk-delete workpool job, and the
 * project-cascade `projects.remove` — same cascade, one place to
 * maintain it. Exported so cross-file callers don't duplicate the loop.
 */
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

/** Minimal writer shape for the cascade helper — keeps it usable from
 *  both `mutation` and `internalMutation` ctx without dragging in the
 *  full Convex generic. */
type MutationCtxDb = import("../_generated/server").MutationCtx["db"];

/**
 * Creates the tracking row for a bulk delete. Mirror of
 * `_createImportBatch`. Caller has already validated ownership.
 */
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

/**
 * Workpool `onComplete` callback for bulk delete. Mirror of
 * `_onImportFileComplete` — inserts per-item outcome rows instead of
 * patching shared counters.
 */
export const _onDeleteFileComplete = internalMutation({
  args: {
    workId: v.string(),
    context: v.any(),
    result: v.any(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { batchId, label } = args.context as {
      batchId: Id<"delete_batches">;
      label: string;
    };
    const result = args.result as
      | { kind: "success"; returnValue: unknown }
      | { kind: "failed"; error: string }
      | { kind: "canceled" };

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

/**
 * Reactive read for the bulk-delete progress UI. Mirrors `getImportBatch`
 * — counts derive from `delete_job_outcomes` rather than the batch row.
 */
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

/* ------------------------------------------------------------------ */
/*  Smart sync — diff-before-enqueue support                            */
/* ------------------------------------------------------------------ */

/**
 * Returns the existing Convex docs (lite shape) for a set of GitHub
 * paths within a project, used by `startBulkImport` to classify each
 * requested path as new / unchanged / fast-forward / conflict.
 *
 * Trashed docs are excluded — re-importing a path that points to a
 * doc currently in the trash treats it as `new` (the import will
 * create a fresh row, the trashed row stays put until its retention
 * expires). That's deliberate: a user who deleted then re-imported
 * almost certainly wants a clean slate.
 *
 * Per-path indexed lookup so projects with many docs don't pay the
 * cost of a full project scan. Convex's `unique()` on the
 * `by_projectId_and_githubPath` index returns null when no match,
 * which we elide from the result.
 */
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

/**
 * Internal upsert used by `_importOneFromGithubJob` after the action's
 * diff-before-enqueue logic has classified the path as `new` or
 * `fast-forward`. Unlike the older `_importFromGithubInternal` it does
 * not dedup-and-return — by this point the caller already knows it
 * wants the doc written. Stamps `githubSyncedAt` so the next sync
 * starts from a clean baseline.
 */
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
    /**
     * The classifier in `startBulkImport` resolves this. `new` inserts,
     * `fastForward` patches the existing row. Passed explicitly so
     * this mutation has no side-channel — it can't accidentally create
     * duplicate rows for a known path.
     */
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
      const patch: Record<string, unknown> = {
        title: args.title,
        slug: args.slug,
        excerpt: buildExcerpt(args.content),
        wordCount: newWc,
        githubSha: args.githubSha,
        githubSyncedAt: args.githubSyncedAt,
        updatedAt: now,
      };
      if (args.frontmatter !== undefined) {
        patch["frontmatter"] = args.frontmatter;
      }
      const contentId = await writeContent(ctx, {
        documentId: existing._id,
        projectId: args.projectId,
        userId: project.userId,
        content: args.content,
        ...(existing.contentId ? { contentId: existing.contentId } : {}),
      });
      if (existing.contentId === undefined) {
        patch["contentId"] = contentId;
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
      const patch: Record<string, unknown> = {
        excerpt: buildExcerpt(args.content),
        wordCount: newWc,
        githubSha: args.githubSha,
        githubSyncedAt: args.githubSyncedAt,
        updatedAt: now,
      };
      if (args.frontmatter !== undefined) {
        patch["frontmatter"] = args.frontmatter;
      }
      const contentId = await writeContent(ctx, {
        documentId: existing._id,
        projectId: args.projectId,
        userId: project.userId,
        content: args.content,
        ...(existing.contentId ? { contentId: existing.contentId } : {}),
      });
      if (existing.contentId === undefined) {
        patch["contentId"] = contentId;
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
    // Stamp the pointer at creation so later edits skip the read-before-write.
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

/**
 * One-shot backfill: any doc that has a `githubSha` set but no
 * `githubSyncedAt` is assumed to be in sync with GitHub as of right now,
 * so the next sync doesn't flag it as a conflict.
 *
 * Implemented as a self-scheduling chunk pattern (per Convex guidelines):
 * each mutation processes one page and reschedules itself for the next.
 * The previous while-loop variant ran every page in a single transaction
 * which risked hitting per-transaction read/write limits on larger
 * deployments and leaving the backfill half-applied.
 *
 * Kick off via the Convex dashboard with `cursor: undefined`. The action
 * returns the per-page counts; the rolled-up `_backfillGithubSyncedAt`
 * entry point reports the totals when the run completes.
 */
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

/**
 * One-shot backfill of the `document_links` graph for pre-existing documents.
 * Cursor-paginated over every document (small chunk — each doc's link sync
 * reads up to 500 project metadata rows, so we keep the per-transaction
 * footprint bounded), reading each body via the `document_content` helper and
 * running the same `syncDocumentLinks` used by the flush paths.
 *
 * Idempotent: `syncDocumentLinks` deletes-then-reinserts a source's edges, so
 * re-running (or resuming after a partial run) converges to the same graph.
 * CLI-driven only — there is no admin UI:
 *   bun x convex run cms/documents:_backfillDocumentLinks
 * Pass `{ "cursor": "<continueCursor>" }` to resume a specific page; omit to
 * start from the beginning (it self-schedules subsequent pages).
 */
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
      // Trashed docs are invisible everywhere else; skip so we don't
      // resurrect edges for documents on their way out.
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
