import { v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type {
  DatabaseReader,
  MutationCtx,
  QueryCtx,
} from "../_generated/server";
import { mutation, query } from "../_generated/server";
import { getAuthedUserOrNull, getCurrentUser } from "../_lib/auth";
import { getRateLimitKey, rateLimiter } from "../_lib/rateLimits";

const researchTypeValidator = v.union(
  v.literal("note"),
  v.literal("source"),
  v.literal("quote"),
  v.literal("outline"),
  v.literal("idea"),
  v.literal("ai_summary"),
);

async function verifyDocumentOwnership(
  ctx: { db: DatabaseReader },
  documentId: Id<"documents">,
  userId: Id<"users">,
): Promise<Doc<"documents">> {
  const document = await ctx.db.get(documentId);
  if (!document || document.trashedAt !== undefined) {
    throw new Error("Document not found");
  }
  const project = await ctx.db.get(document.projectId);
  if (!project || project.userId !== userId) {
    throw new Error("Unauthorized: you do not own this document");
  }
  return document;
}

export const list = query({
  args: { documentId: v.id("documents") },
  handler: async (ctx, args) => {
    const user = await getAuthedUserOrNull(ctx);
    if (!user) return [];
    return await researchForUser(ctx, user._id, args.documentId);
  },
});

/** `list`'s body with the actor passed in explicitly. Shared with the MCP
 *  handler, which has no `ctx.auth` — see `_lib/auth.ts → requireCaller`. */
export async function researchForUser(
  ctx: QueryCtx,
  userId: Id<"users">,
  documentId: Id<"documents">,
) {
  {
    await verifyDocumentOwnership(ctx, documentId, userId);

    const items = await ctx.db
      .query("document_research")
      .withIndex("by_documentId", (q) => q.eq("documentId", documentId))
      .take(200);

    return items.sort((a, b) => b.updatedAt - a.updatedAt);
  }
}

export const listSelectedForAi = query({
  args: { documentId: v.id("documents"), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const user = await getAuthedUserOrNull(ctx);
    if (!user) return [];
    await verifyDocumentOwnership(ctx, args.documentId, user._id);

    return await ctx.db
      .query("document_research")
      .withIndex("by_documentId_and_selectedForAi", (q) =>
        q.eq("documentId", args.documentId).eq("selectedForAi", true),
      )
      .order("desc")
      .take(Math.min(args.limit ?? 20, 30));
  },
});

export const create = mutation({
  args: {
    documentId: v.id("documents"),
    type: researchTypeValidator,
    title: v.string(),
    content: v.string(),
    url: v.optional(v.string()),
    sourceName: v.optional(v.string()),
    selectedForAi: v.optional(v.boolean()),
  },
  handler: async (ctx, args) =>
    await createResearchForUser(ctx, await getCurrentUser(ctx), args),
});

/** `create`'s body with the actor passed in explicitly. */
export async function createResearchForUser(
  ctx: MutationCtx,
  user: Doc<"users">,
  args: {
    documentId: Id<"documents">;
    type: Doc<"document_research">["type"];
    title: string;
    content: string;
    url?: string;
    sourceName?: string;
    selectedForAi?: boolean;
  },
) {
  {
    await rateLimiter.limit(ctx, "documentResearch:create", {
      key: user.tokenIdentifier,
      throws: true,
    });

    const document = await verifyDocumentOwnership(
      ctx,
      args.documentId,
      user._id,
    );
    const now = Date.now();

    return await ctx.db.insert("document_research", {
      documentId: args.documentId,
      projectId: document.projectId,
      userId: user._id,
      type: args.type,
      title: args.title.trim() || "Untitled research",
      content: args.content,
      ...(args.url?.trim() ? { url: args.url.trim() } : {}),
      ...(args.sourceName?.trim()
        ? { sourceName: args.sourceName.trim() }
        : {}),
      selectedForAi: args.selectedForAi ?? true,
      createdAt: now,
      updatedAt: now,
    });
  }
}

export const update = mutation({
  args: {
    researchId: v.id("document_research"),
    type: v.optional(researchTypeValidator),
    title: v.optional(v.string()),
    content: v.optional(v.string()),
    url: v.optional(v.string()),
    sourceName: v.optional(v.string()),
    selectedForAi: v.optional(v.boolean()),
  },
  handler: async (ctx, args) =>
    await updateResearchForUser(ctx, await getCurrentUser(ctx), args),
});

/** `update`'s body with the actor passed in explicitly. */
export async function updateResearchForUser(
  ctx: MutationCtx,
  user: Doc<"users">,
  args: {
    researchId: Id<"document_research">;
    type?: Doc<"document_research">["type"];
    title?: string;
    content?: string;
    url?: string;
    sourceName?: string;
    selectedForAi?: boolean;
  },
) {
  {
    await rateLimiter.limit(ctx, "documentResearch:update", {
      key: user.tokenIdentifier,
      throws: true,
    });

    const item = await ctx.db.get(args.researchId);
    if (!item || item.userId !== user._id) {
      throw new Error("Research item not found");
    }

    const updates: {
      type?: Doc<"document_research">["type"];
      title?: string;
      content?: string;
      url?: string;
      sourceName?: string;
      selectedForAi?: boolean;
      updatedAt: number;
    } = { updatedAt: Date.now() };
    if (args.type !== undefined) updates.type = args.type;
    if (args.title !== undefined)
      updates.title = args.title.trim() || "Untitled research";
    if (args.content !== undefined) updates.content = args.content;
    if (args.url !== undefined) updates.url = args.url.trim();
    if (args.sourceName !== undefined)
      updates.sourceName = args.sourceName.trim();
    if (args.selectedForAi !== undefined)
      updates.selectedForAi = args.selectedForAi;

    await ctx.db.patch(args.researchId, updates);
  }
}

export const toggleSelectedForAi = mutation({
  args: { researchId: v.id("document_research"), selectedForAi: v.boolean() },
  handler: async (ctx, args) => {
    const key = await getRateLimitKey(ctx);
    await rateLimiter.limit(ctx, "documentResearch:update", {
      key,
      throws: true,
    });

    const user = await getCurrentUser(ctx);
    const item = await ctx.db.get(args.researchId);
    if (!item || item.userId !== user._id) {
      throw new Error("Research item not found");
    }
    await ctx.db.patch(args.researchId, {
      selectedForAi: args.selectedForAi,
      updatedAt: Date.now(),
    });
  },
});

export const remove = mutation({
  args: { researchId: v.id("document_research") },
  handler: async (ctx, args) =>
    await removeResearchForUser(ctx, await getCurrentUser(ctx), args),
});

/** `remove`'s body with the actor passed in explicitly. */
export async function removeResearchForUser(
  ctx: MutationCtx,
  user: Doc<"users">,
  args: { researchId: Id<"document_research"> },
) {
  {
    await rateLimiter.limit(ctx, "documentResearch:remove", {
      key: user.tokenIdentifier,
      throws: true,
    });

    const item = await ctx.db.get(args.researchId);
    if (!item || item.userId !== user._id) {
      throw new Error("Research item not found");
    }
    await ctx.db.delete(args.researchId);
  }
}
