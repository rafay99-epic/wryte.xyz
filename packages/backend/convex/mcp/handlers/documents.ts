import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { mcpCallerValidator } from "convex-mcp-gateway";
import { internalMutation, internalQuery } from "../../_generated/server";
import { requireCaller } from "../../_lib/auth";
import {
  backlinksForUser,
  calendarForUser,
  createDocumentForUser,
  documentsPageForUser,
  documentWithContentForUser,
  publishHistoryForUser,
  searchDocumentsForUser,
  trashDocumentForUser,
  updateDocumentForUser,
} from "../../cms/documents";

const MAX_PAGE_SIZE = 100;

export const list = internalQuery({
  args: {
    caller: mcpCallerValidator,
    projectId: v.id("projects"),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const user = await requireCaller(ctx, args.caller);
    return await documentsPageForUser(ctx, user._id, args.projectId, {
      ...args.paginationOpts,
      numItems: Math.min(args.paginationOpts.numItems, MAX_PAGE_SIZE),
    });
  },
});

export const search = internalQuery({
  args: {
    caller: mcpCallerValidator,
    term: v.string(),
    projectId: v.optional(v.id("projects")),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await requireCaller(ctx, args.caller);
    const { caller: _caller, ...rest } = args;
    return await searchDocumentsForUser(ctx, user._id, rest);
  },
});

export const get = internalQuery({
  args: { caller: mcpCallerValidator, documentId: v.id("documents") },
  handler: async (ctx, args) => {
    const user = await requireCaller(ctx, args.caller);
    return await documentWithContentForUser(ctx, user._id, args.documentId);
  },
});

export const backlinks = internalQuery({
  args: { caller: mcpCallerValidator, documentId: v.id("documents") },
  handler: async (ctx, args) => {
    const user = await requireCaller(ctx, args.caller);
    return await backlinksForUser(ctx, user._id, args.documentId);
  },
});

export const history = internalQuery({
  args: { caller: mcpCallerValidator, documentId: v.id("documents") },
  handler: async (ctx, args) => {
    const user = await requireCaller(ctx, args.caller);
    return await publishHistoryForUser(ctx, user._id, args.documentId);
  },
});

export const calendar = internalQuery({
  args: { caller: mcpCallerValidator, projectId: v.id("projects") },
  handler: async (ctx, args) => {
    const user = await requireCaller(ctx, args.caller);
    return await calendarForUser(ctx, user._id, args.projectId);
  },
});

export const create = internalMutation({
  args: {
    caller: mcpCallerValidator,
    projectId: v.id("projects"),
    title: v.string(),
    slug: v.string(),
    status: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
    frontmatter: v.optional(v.string()),
    content: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireCaller(ctx, args.caller);
    const { caller: _caller, ...rest } = args;
    return await createDocumentForUser(ctx, user, rest);
  },
});

export const update = internalMutation({
  args: {
    caller: mcpCallerValidator,
    documentId: v.id("documents"),
    title: v.optional(v.string()),
    slug: v.optional(v.string()),
    content: v.optional(v.string()),
    frontmatter: v.optional(v.string()),
    status: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const user = await requireCaller(ctx, args.caller);
    const { caller: _caller, ...rest } = args;
    return await updateDocumentForUser(ctx, user, rest);
  },
});

export const trash = internalMutation({
  args: { caller: mcpCallerValidator, documentId: v.id("documents") },
  handler: async (ctx, args) => {
    const user = await requireCaller(ctx, args.caller);
    return await trashDocumentForUser(ctx, user, {
      documentId: args.documentId,
    });
  },
});
