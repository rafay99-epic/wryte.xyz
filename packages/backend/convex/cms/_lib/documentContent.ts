import type { Id } from "../../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../../_generated/server";

const EXCERPT_LENGTH = 200;

export const MIN_CONTENT_TERM = 3;

export const CONTENT_SEARCH_LIMIT = 8;

export const CONTENT_SEARCH_DEBOUNCE_MS = 200;

export function buildExcerpt(content: string): string {
  return content.length > EXCERPT_LENGTH
    ? `${content.slice(0, EXCERPT_LENGTH)}...`
    : content;
}

const SNIPPET_RADIUS = 90;

export function extractSnippet(content: string, term: string): string {
  const haystack = content.toLowerCase();
  const firstHit =
    term
      .toLowerCase()
      .split(/\s+/)
      .map((token) => haystack.indexOf(token))
      .filter((index) => index >= 0)
      .sort((a, b) => a - b)[0] ?? 0;

  const start = Math.max(0, firstHit - SNIPPET_RADIUS);
  const end = Math.min(content.length, firstHit + SNIPPET_RADIUS);
  const body = content.slice(start, end).replace(/\s+/g, " ").trim();

  return `${start > 0 ? "…" : ""}${body}${end < content.length ? "…" : ""}`;
}

export async function readContent(
  ctx: { db: QueryCtx["db"] },
  doc: {
    _id: Id<"documents">;
    contentId?: Id<"document_content">;
  },
): Promise<string> {
  if (doc.contentId) {
    const row = await ctx.db.get(doc.contentId);
    if (row) return row.content;
  }
  const row = await ctx.db
    .query("document_content")
    .withIndex("by_documentId", (q) => q.eq("documentId", doc._id))
    .unique();
  if (row) return row.content;
  return "";
}

export async function readContentById(
  ctx: { db: QueryCtx["db"] },
  documentId: Id<"documents">,
): Promise<string> {
  const row = await ctx.db
    .query("document_content")
    .withIndex("by_documentId", (q) => q.eq("documentId", documentId))
    .unique();
  if (row) return row.content;
  return "";
}

export async function writeContent(
  ctx: MutationCtx,
  params: {
    documentId: Id<"documents">;
    projectId: Id<"projects">;
    userId: Id<"users">;
    content: string;
    contentId?: Id<"document_content">;
  },
): Promise<Id<"document_content">> {
  const now = Date.now();
  if (params.contentId) {
    try {
      await ctx.db.replace(params.contentId, {
        documentId: params.documentId,
        projectId: params.projectId,
        userId: params.userId,
        content: params.content,
        updatedAt: now,
      });
      return params.contentId;
    } catch {}
  }
  const existing = await ctx.db
    .query("document_content")
    .withIndex("by_documentId", (q) => q.eq("documentId", params.documentId))
    .unique();
  if (existing) {
    await ctx.db.patch(existing._id, {
      content: params.content,
      updatedAt: now,
    });
    return existing._id;
  }
  return await ctx.db.insert("document_content", {
    documentId: params.documentId,
    projectId: params.projectId,
    userId: params.userId,
    content: params.content,
    updatedAt: now,
  });
}

export async function deleteContent(
  ctx: MutationCtx,
  documentId: Id<"documents">,
): Promise<void> {
  const existing = await ctx.db
    .query("document_content")
    .withIndex("by_documentId", (q) => q.eq("documentId", documentId))
    .unique();
  if (existing) await ctx.db.delete(existing._id);
}
