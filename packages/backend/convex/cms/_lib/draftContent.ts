import type { Id } from "../../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../../_generated/server";

export const MAX_DRAFT_CONTENT_BYTES = 500 * 1024;

export type DraftContent = { title: string; content: string };

type DraftLike = {
  _id: Id<"document_drafts">;
  contentId?: Id<"document_draft_content">;
};

export async function readDraftContent(
  ctx: { db: QueryCtx["db"] },
  draft: DraftLike,
): Promise<DraftContent> {
  if (draft.contentId) {
    const row = await ctx.db.get(draft.contentId);
    if (row) return { title: row.title, content: row.content };
  }
  const row = await ctx.db
    .query("document_draft_content")
    .withIndex("by_draftId", (q) => q.eq("draftId", draft._id))
    .unique();
  if (row) return { title: row.title, content: row.content };
  return { title: "", content: "" };
}

export async function writeDraftContent(
  ctx: MutationCtx,
  params: {
    draftId: Id<"document_drafts">;
    documentId: Id<"documents">;
    projectId: Id<"projects">;
    userId: Id<"users">;
    title: string;
    content: string;
    contentId?: Id<"document_draft_content">;
  },
): Promise<Id<"document_draft_content">> {
  const now = Date.now();
  const row = {
    draftId: params.draftId,
    documentId: params.documentId,
    projectId: params.projectId,
    userId: params.userId,
    title: params.title,
    content: params.content,
    updatedAt: now,
  };
  if (params.contentId) {
    try {
      await ctx.db.replace(params.contentId, row);
      return params.contentId;
    } catch {}
  }
  const existing = await ctx.db
    .query("document_draft_content")
    .withIndex("by_draftId", (q) => q.eq("draftId", params.draftId))
    .unique();
  if (existing) {
    await ctx.db.replace(existing._id, row);
    return existing._id;
  }
  return await ctx.db.insert("document_draft_content", row);
}

export async function deleteDraftContent(
  ctx: MutationCtx,
  draftId: Id<"document_drafts">,
  contentId?: Id<"document_draft_content">,
): Promise<void> {
  if (contentId) {
    try {
      await ctx.db.delete(contentId);
      return;
    } catch {}
  }
  const existing = await ctx.db
    .query("document_draft_content")
    .withIndex("by_draftId", (q) => q.eq("draftId", draftId))
    .unique();
  if (existing) await ctx.db.delete(existing._id);
}
