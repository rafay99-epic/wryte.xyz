import { v } from "convex/values";
import { mcpCallerValidator } from "convex-mcp-gateway";
import type { Id } from "../../_generated/dataModel";
import type { QueryCtx } from "../../_generated/server";
import { requireCaller } from "../../_lib/auth";
import {
  createDraftSnapshotForUser,
  draftGetForUser,
  draftsListForUser,
  removeDraftForUser,
  updateDraftContentForUser,
  updateDraftMetaForUser,
} from "../../cms/documentDrafts";
import { agentMutation, agentQuery } from "../agentFunctions";
import { agentFrontmatter, agentLabel } from "../agentInput";
import { draftReport } from "../draftReport";

async function projectForDocument(
  ctx: QueryCtx,
  userId: Id<"users">,
  documentId: Id<"documents">,
) {
  const document = await ctx.db.get(documentId);
  const project = document ? await ctx.db.get(document.projectId) : null;
  if (!document || document.userId !== userId || !project) {
    throw new Error("Document not found");
  }
  return project;
}

export const list = agentQuery({
  args: { caller: mcpCallerValidator, documentId: v.id("documents") },
  handler: async (ctx, args) => {
    const user = await requireCaller(ctx, args.caller);
    return await draftsListForUser(ctx, user._id, args.documentId);
  },
});

export const get = agentQuery({
  args: { caller: mcpCallerValidator, draftId: v.id("document_drafts") },
  handler: async (ctx, args) => {
    const user = await requireCaller(ctx, args.caller);
    return await draftGetForUser(ctx, user._id, args.draftId);
  },
});

export const snapshot = agentMutation({
  args: {
    caller: mcpCallerValidator,
    documentId: v.id("documents"),
    label: v.string(),
    title: v.string(),
    content: v.string(),
    frontmatter: v.optional(v.string()),
    summary: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireCaller(ctx, args.caller);
    const project = await projectForDocument(ctx, user._id, args.documentId);
    const { caller: _caller, frontmatter, ...rest } = args;
    const draftId = await createDraftSnapshotForUser(ctx, user, {
      ...rest,
      label: agentLabel(args.label),
      ...(frontmatter !== undefined
        ? { frontmatter: agentFrontmatter(project, frontmatter) }
        : {}),
    });
    const draft = await ctx.db.get(draftId);
    if (!draft) throw new Error("Draft not found");
    return {
      draftId,
      ...(await draftReport(ctx, draft.projectId, args.content)),
    };
  },
});

export const update = agentMutation({
  args: {
    caller: mcpCallerValidator,
    draftId: v.id("document_drafts"),
    label: v.optional(v.string()),
    summary: v.optional(v.string()),
    frontmatter: v.optional(v.string()),
    title: v.optional(v.string()),
    content: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireCaller(ctx, args.caller);
    const { caller: _caller, draftId, title, content, ...fields } = args;
    if (
      title === undefined &&
      content === undefined &&
      Object.values(fields).every((value) => value === undefined)
    ) {
      throw new Error(
        "Nothing to update: pass label, summary, frontmatter, title or content.",
      );
    }
    const existing = await ctx.db.get(draftId);
    if (!existing || existing.userId !== user._id) {
      throw new Error("Draft not found");
    }
    const project = await projectForDocument(
      ctx,
      user._id,
      existing.documentId,
    );
    const meta = {
      ...fields,
      ...(fields.label !== undefined
        ? { label: agentLabel(fields.label) }
        : {}),
      ...(fields.frontmatter !== undefined
        ? { frontmatter: agentFrontmatter(project, fields.frontmatter) }
        : {}),
    };

    if (Object.values(meta).some((value) => value !== undefined)) {
      await updateDraftMetaForUser(ctx, user, { draftId, ...meta });
    }
    if (title !== undefined || content !== undefined) {
      await updateDraftContentForUser(ctx, user, {
        draftId,
        ...(title !== undefined ? { title } : {}),
        ...(content !== undefined ? { content } : {}),
      });
    }

    const draft = await ctx.db.get(draftId);
    if (!draft) throw new Error("Draft not found");
    return {
      draftId,
      ...(content !== undefined
        ? await draftReport(ctx, draft.projectId, content)
        : { unknownComponents: [], mdxError: null }),
    };
  },
});

export const remove = agentMutation({
  args: { caller: mcpCallerValidator, draftId: v.id("document_drafts") },
  handler: async (ctx, args) => {
    const user = await requireCaller(ctx, args.caller);
    return await removeDraftForUser(ctx, user, { draftId: args.draftId });
  },
});
