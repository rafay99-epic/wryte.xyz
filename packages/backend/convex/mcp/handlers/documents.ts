import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { mcpCallerValidator } from "convex-mcp-gateway";
import type { Doc, Id } from "../../_generated/dataModel";
import type { QueryCtx } from "../../_generated/server";
import {
  type AnimationCheckStatus,
  isCheckCurrent,
} from "../../_lib/animationChecks";
import { mdxComponentNames } from "../../_lib/animationTransform";
import { requireCaller } from "../../_lib/auth";
import { readContent } from "../../cms/_lib/documentContent";
import { readDraftContent } from "../../cms/_lib/draftContent";
import { researchForUser } from "../../cms/documentResearch";
import {
  backlinksForUser,
  calendarForUser,
  createDocumentForUser,
  documentForUser,
  documentsPageForUser,
  publishHistoryForUser,
  searchDocumentsForUser,
  trashDocumentForUser,
  updateDocumentForUser,
} from "../../cms/documents";
import { agentMutation, agentQuery } from "../agentFunctions";
import {
  agentFrontmatter,
  agentSlug,
  agentTags,
  agentTitle,
  assertSlugFree,
} from "../agentInput";
import { agentDocumentView } from "../documentView";
import { frontmatterContract } from "../frontmatterSchema";
import { agentStatuses, assertAgentStatus } from "../projectContext";

const MAX_PAGE_SIZE = 100;
const MAX_SCANNED_DRAFTS = 20;
const MAX_POST_MEDIA = 50;

async function ownedProject(
  ctx: QueryCtx,
  userId: Id<"users">,
  projectId: Id<"projects">,
): Promise<Doc<"projects">> {
  const project = await ctx.db.get(projectId);
  if (!project || project.userId !== userId) {
    throw new Error("Project not found");
  }
  return project;
}

async function requireDocument(
  ctx: QueryCtx,
  userId: Id<"users">,
  documentId: Id<"documents">,
): Promise<Doc<"documents">> {
  const document = await documentForUser(ctx, userId, documentId);
  if (!document) throw new Error("Document not found");
  return document;
}

export const list = agentQuery({
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

export const search = agentQuery({
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

export const get = agentQuery({
  args: { caller: mcpCallerValidator, documentId: v.id("documents") },
  handler: async (ctx, args) => {
    const user = await requireCaller(ctx, args.caller);
    const document = await documentForUser(ctx, user._id, args.documentId);
    return document ? agentDocumentView(document) : null;
  },
});

export const workspace = agentQuery({
  args: { caller: mcpCallerValidator, documentId: v.id("documents") },
  handler: async (ctx, args) => {
    const user = await requireCaller(ctx, args.caller);
    const document = await requireDocument(ctx, user._id, args.documentId);
    const project = await ownedProject(ctx, user._id, document.projectId);

    const [drafts, research, animationRows, media] = await Promise.all([
      ctx.db
        .query("document_drafts")
        .withIndex("by_documentId", (q) => q.eq("documentId", document._id))
        .take(50),
      researchForUser(ctx, user._id, document._id),
      ctx.db
        .query("animations")
        .withIndex("by_project", (q) => q.eq("projectId", project._id))
        .take(200),
      ctx.db
        .query("media")
        .withIndex("by_documentId", (q) => q.eq("documentId", document._id))
        .order("desc")
        .take(MAX_POST_MEDIA),
    ]);

    const ordered = drafts.sort((a, b) => b.updatedAt - a.updatedAt);
    const references = new Map<string, Id<"document_drafts">[]>();
    const mdxErrors: { draftId: Id<"document_drafts">; error: string }[] = [];

    if (project.contentFormat === "mdx") {
      for (const draft of ordered.slice(0, MAX_SCANNED_DRAFTS)) {
        const { content } = await readDraftContent(ctx, draft);
        const scan = mdxComponentNames(content);
        if ("error" in scan) {
          mdxErrors.push({ draftId: draft._id, error: scan.error });
          continue;
        }
        for (const name of scan.names) {
          references.set(name, [...(references.get(name) ?? []), draft._id]);
        }
      }
    }

    const byName = new Map(animationRows.map((row) => [row.name, row]));
    const animations = [...references].map(([name, referencedIn]) => {
      const row = byName.get(name);
      const check: AnimationCheckStatus | "stale" | "missing" =
        row === undefined
          ? "missing"
          : isCheckCurrent(row.check, row.source)
            ? row.check.status
            : "stale";
      return { name, referencedIn, check };
    });

    return {
      document: agentDocumentView(document),
      drafts: ordered.map((draft) => ({
        draftId: draft._id,
        label: draft.label,
        summary: draft.summary ?? null,
        wordCount: draft.wordCount,
        updatedAt: draft.updatedAt,
      })),
      research,
      animations,
      mdxErrors,
      media: media.map((row) => ({
        mediaId: row._id,
        url: row.url ?? null,
        filename: row.filename ?? null,
        provider: row.provider ?? null,
      })),
    };
  },
});

export const backlinks = agentQuery({
  args: { caller: mcpCallerValidator, documentId: v.id("documents") },
  handler: async (ctx, args) => {
    const user = await requireCaller(ctx, args.caller);
    return await backlinksForUser(ctx, user._id, args.documentId);
  },
});

export const history = agentQuery({
  args: { caller: mcpCallerValidator, documentId: v.id("documents") },
  handler: async (ctx, args) => {
    const user = await requireCaller(ctx, args.caller);
    return await publishHistoryForUser(ctx, user._id, args.documentId);
  },
});

export const calendar = agentQuery({
  args: { caller: mcpCallerValidator, projectId: v.id("projects") },
  handler: async (ctx, args) => {
    const user = await requireCaller(ctx, args.caller);
    return await calendarForUser(ctx, user._id, args.projectId);
  },
});

export const create = agentMutation({
  args: {
    caller: mcpCallerValidator,
    projectId: v.id("projects"),
    title: v.string(),
    slug: v.string(),
    status: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
    frontmatter: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireCaller(ctx, args.caller);
    const project = await ownedProject(ctx, user._id, args.projectId);
    const status = args.status ?? agentStatuses(project)[0]?.id;
    if (status !== undefined) assertAgentStatus(project, status);
    const title = agentTitle(args.title);
    const slug = agentSlug(args.slug);
    const frontmatter =
      args.frontmatter !== undefined ||
      frontmatterContract(project.frontmatterSchema).requiredFields.length > 0
        ? agentFrontmatter(project, args.frontmatter ?? "{}")
        : undefined;
    await assertSlugFree(ctx, project._id, slug);
    return await createDocumentForUser(ctx, user, {
      projectId: project._id,
      title,
      slug,
      ...(status !== undefined ? { status } : {}),
      ...(args.tags !== undefined ? { tags: agentTags(args.tags) } : {}),
      ...(frontmatter !== undefined ? { frontmatter } : {}),
    });
  },
});

export const update = agentMutation({
  args: {
    caller: mcpCallerValidator,
    documentId: v.id("documents"),
    status: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const user = await requireCaller(ctx, args.caller);
    if (args.status === undefined && args.tags === undefined) {
      throw new Error("Nothing to update: pass status, tags or both.");
    }
    if (args.status !== undefined) {
      const document = await requireDocument(ctx, user._id, args.documentId);
      const project = await ownedProject(ctx, user._id, document.projectId);
      assertAgentStatus(project, document.status);
      assertAgentStatus(project, args.status);
    }
    return await updateDocumentForUser(ctx, user, {
      documentId: args.documentId,
      ...(args.status !== undefined ? { status: args.status } : {}),
      ...(args.tags !== undefined ? { tags: agentTags(args.tags) } : {}),
    });
  },
});

export const trash = agentMutation({
  args: { caller: mcpCallerValidator, documentId: v.id("documents") },
  handler: async (ctx, args) => {
    const user = await requireCaller(ctx, args.caller);
    const document = await requireDocument(ctx, user._id, args.documentId);
    if ((await readContent(ctx, document)).trim() !== "") {
      throw new Error(
        "This post has a Main version, so only the user can trash it in Wryte.",
      );
    }
    return await trashDocumentForUser(ctx, user, {
      documentId: args.documentId,
    });
  },
});
