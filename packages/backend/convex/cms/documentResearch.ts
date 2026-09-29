import { type Infer, v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type {
  DatabaseReader,
  MutationCtx,
  QueryCtx,
} from "../_generated/server";
import { mutation, query } from "../_generated/server";
import { getAuthedUserOrNull, getCurrentUser } from "../_lib/auth";
import { getRateLimitKey, rateLimiter } from "../_lib/rateLimits";

export const researchTypeValidator = v.union(
  v.literal("note"),
  v.literal("source"),
  v.literal("quote"),
  v.literal("outline"),
  v.literal("idea"),
  v.literal("ai_summary"),
);

export const researchItemValidator = v.object({
  type: researchTypeValidator,
  title: v.string(),
  content: v.string(),
  url: v.optional(v.string()),
  sourceName: v.optional(v.string()),
  selectedForAi: v.optional(v.boolean()),
});

export type ResearchItem = Infer<typeof researchItemValidator>;

export const MAX_RESEARCH_BATCH = 15;
const MAX_RESEARCH_CONTENT_BYTES = 100 * 1024;

function assertResearchContent(content: string): void {
  if (
    new TextEncoder().encode(content).byteLength > MAX_RESEARCH_CONTENT_BYTES
  ) {
    throw new Error(
      `Research content is too large (max ${String(MAX_RESEARCH_CONTENT_BYTES / 1024)} KB).`,
    );
  }
}

function researchUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  const url = /^[a-z][a-z0-9+.-]*:/i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;
  let protocol = "";
  try {
    protocol = new URL(url).protocol;
  } catch {}
  if (protocol !== "http:" && protocol !== "https:") {
    throw new Error("Research url must be an http or https link.");
  }
  return url;
}

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

export async function researchForUser(
  ctx: QueryCtx,
  userId: Id<"users">,
  documentId: Id<"documents">,
) {
  await verifyDocumentOwnership(ctx, documentId, userId);

  const items = await ctx.db
    .query("document_research")
    .withIndex("by_documentId", (q) => q.eq("documentId", documentId))
    .take(200);

  return items.sort((a, b) => b.updatedAt - a.updatedAt);
}

export const create = mutation({
  args: { documentId: v.id("documents"), ...researchItemValidator.fields },
  handler: async (ctx, args) => {
    const { documentId, ...item } = args;
    const [id] = await createResearchBatchForUser(
      ctx,
      await getCurrentUser(ctx),
      { documentId, items: [item] },
    );
    if (!id) throw new Error("Research was not created");
    return id;
  },
});

export async function createResearchBatchForUser(
  ctx: MutationCtx,
  user: Doc<"users">,
  args: { documentId: Id<"documents">; items: ResearchItem[] },
): Promise<Id<"document_research">[]> {
  if (args.items.length === 0) {
    throw new Error("Send at least one research item.");
  }
  if (args.items.length > MAX_RESEARCH_BATCH) {
    throw new Error(
      `At most ${String(MAX_RESEARCH_BATCH)} research items per call.`,
    );
  }

  const urls = args.items.map((item) => researchUrl(item.url ?? ""));
  for (const item of args.items) assertResearchContent(item.content);

  await rateLimiter.limit(ctx, "documentResearch:create", {
    key: user.tokenIdentifier,
    count: args.items.length,
    throws: true,
  });

  const document = await verifyDocumentOwnership(
    ctx,
    args.documentId,
    user._id,
  );
  const now = Date.now();

  const ids: Id<"document_research">[] = [];
  for (const [index, item] of args.items.entries()) {
    const url = urls[index];
    ids.push(
      await ctx.db.insert("document_research", {
        documentId: args.documentId,
        projectId: document.projectId,
        userId: user._id,
        type: item.type,
        title: item.title.trim() || "Untitled research",
        content: item.content,
        ...(url ? { url } : {}),
        ...(item.sourceName?.trim()
          ? { sourceName: item.sourceName.trim() }
          : {}),
        selectedForAi: item.selectedForAi ?? true,
        createdAt: now,
        updatedAt: now,
      }),
    );
  }
  return ids;
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
  if (args.content !== undefined) {
    assertResearchContent(args.content);
    updates.content = args.content;
  }
  if (args.url !== undefined) updates.url = researchUrl(args.url);
  if (args.sourceName !== undefined)
    updates.sourceName = args.sourceName.trim();
  if (args.selectedForAi !== undefined)
    updates.selectedForAi = args.selectedForAi;

  await ctx.db.patch(args.researchId, updates);
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

export async function removeResearchForUser(
  ctx: MutationCtx,
  user: Doc<"users">,
  args: { researchId: Id<"document_research"> },
) {
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
