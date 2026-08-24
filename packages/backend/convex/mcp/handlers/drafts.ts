/**
 * MCP handlers for document draft operations.
 *
 * Same contract as `./documents.ts`: `internal*` only, actor injected by the
 * gateway via `identityArg`, zero business logic — every handler resolves the
 * caller and delegates to the helper the public function also uses, so the
 * two entry points cannot drift.
 */
import { v } from "convex/values";
import { mcpCallerValidator } from "convex-mcp-gateway";
import { internalMutation, internalQuery } from "../../_generated/server";
import { requireCaller } from "../../_lib/auth";
import {
  createDraftForUser,
  createDraftSnapshotForUser,
  draftGetForUser,
  draftsListForUser,
  promoteDraftToMainForUser,
  removeDraftForUser,
  updateDraftContentForUser,
} from "../../cms/documentDrafts";

/* ------------------------------- reads -------------------------------- */

export const list = internalQuery({
  args: { caller: mcpCallerValidator, documentId: v.id("documents") },
  handler: async (ctx, args) => {
    const user = await requireCaller(ctx, args.caller);
    return await draftsListForUser(ctx, user._id, args.documentId);
  },
});

export const get = internalQuery({
  args: { caller: mcpCallerValidator, draftId: v.id("document_drafts") },
  handler: async (ctx, args) => {
    const user = await requireCaller(ctx, args.caller);
    return await draftGetForUser(ctx, user._id, args.draftId);
  },
});

/* ------------------------------- writes ------------------------------- */

export const create = internalMutation({
  args: {
    caller: mcpCallerValidator,
    documentId: v.id("documents"),
    label: v.optional(v.string()),
    copyFromMain: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const user = await requireCaller(ctx, args.caller);
    const { caller: _caller, ...rest } = args;
    return await createDraftForUser(ctx, user, rest);
  },
});

export const createSnapshot = internalMutation({
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
    const { caller: _caller, ...rest } = args;
    return await createDraftSnapshotForUser(ctx, user, rest);
  },
});

export const updateContent = internalMutation({
  args: {
    caller: mcpCallerValidator,
    draftId: v.id("document_drafts"),
    title: v.optional(v.string()),
    content: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireCaller(ctx, args.caller);
    const { caller: _caller, ...rest } = args;
    return await updateDraftContentForUser(ctx, user, rest);
  },
});

export const promote = internalMutation({
  args: { caller: mcpCallerValidator, draftId: v.id("document_drafts") },
  handler: async (ctx, args) => {
    const user = await requireCaller(ctx, args.caller);
    return await promoteDraftToMainForUser(ctx, user, {
      draftId: args.draftId,
    });
  },
});

export const remove = internalMutation({
  args: { caller: mcpCallerValidator, draftId: v.id("document_drafts") },
  handler: async (ctx, args) => {
    const user = await requireCaller(ctx, args.caller);
    return await removeDraftForUser(ctx, user, { draftId: args.draftId });
  },
});
