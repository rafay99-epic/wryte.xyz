import type { Doc, Id } from "../../_generated/dataModel";
import type { MutationCtx } from "../../_generated/server";

const FENCE_LINE_RE = /^(```|~~~)/;
const WIKI_LINK_RE = /\[\[([^\]\n]+)\]\]/g;
const INLINE_CODE_RE = /`[^`\n]*`/g;

const RESOLVE_SCAN_CAP = 500;

function stripCode(content: string): string {
  let inFence = false;
  const out: string[] = [];
  for (const line of content.split("\n")) {
    if (FENCE_LINE_RE.test(line.trimStart())) {
      inFence = !inFence;
      out.push("");
      continue;
    }
    out.push(inFence ? "" : line);
  }
  return out.join("\n").replace(INLINE_CODE_RE, "");
}

export function extractWikiTargets(content: string): string[] {
  const scanned = stripCode(content);
  const targets: string[] = [];
  const seen = new Set<string>();
  WIKI_LINK_RE.lastIndex = 0;
  let match = WIKI_LINK_RE.exec(scanned);
  while (match) {
    const target = (match[1] ?? "").split("|")[0]?.trim() ?? "";
    const key = target.toLowerCase();
    if (target && !seen.has(key)) {
      seen.add(key);
      targets.push(target);
    }
    match = WIKI_LINK_RE.exec(scanned);
  }
  return targets;
}

export async function syncDocumentLinks(
  ctx: MutationCtx,
  doc: Doc<"documents">,
  content: string,
): Promise<void> {
  const existing = await ctx.db
    .query("document_links")
    .withIndex("by_sourceDocumentId", (q) => q.eq("sourceDocumentId", doc._id))
    .take(RESOLVE_SCAN_CAP);
  for (const row of existing) {
    await ctx.db.delete(row._id);
  }

  const targets = extractWikiTargets(content);
  if (targets.length === 0) return;

  const projectDocs = await ctx.db
    .query("documents")
    .withIndex("by_projectId", (q) => q.eq("projectId", doc.projectId))
    .take(RESOLVE_SCAN_CAP);
  const byKey = new Map<string, Id<"documents">>();
  for (const candidate of projectDocs) {
    if (candidate.trashedAt !== undefined) continue;
    if (candidate._id === doc._id) continue;
    const titleKey = candidate.title.trim().toLowerCase();
    const slugKey = candidate.slug.trim().toLowerCase();
    if (titleKey && !byKey.has(titleKey)) byKey.set(titleKey, candidate._id);
    if (slugKey && !byKey.has(slugKey)) byKey.set(slugKey, candidate._id);
  }

  const now = Date.now();
  const linked = new Set<Id<"documents">>();
  for (const target of targets) {
    const targetId = byKey.get(target.toLowerCase());
    if (!targetId) continue;
    if (targetId === doc._id) continue;
    if (linked.has(targetId)) continue;
    linked.add(targetId);
    await ctx.db.insert("document_links", {
      sourceDocumentId: doc._id,
      targetDocumentId: targetId,
      projectId: doc.projectId,
      userId: doc.userId,
      createdAt: now,
    });
  }
}

export async function drainDocumentLinksForDoc(
  ctx: MutationCtx,
  documentId: Id<"documents">,
  budget: number,
): Promise<{ deleted: number; remaining: boolean }> {
  let remainingBudget = budget;
  let deleted = 0;

  if (remainingBudget > 0) {
    const rows = await ctx.db
      .query("document_links")
      .withIndex("by_sourceDocumentId", (q) =>
        q.eq("sourceDocumentId", documentId),
      )
      .take(remainingBudget);
    for (const row of rows) {
      await ctx.db.delete(row._id);
      remainingBudget--;
      deleted++;
    }
  }

  if (remainingBudget > 0) {
    const rows = await ctx.db
      .query("document_links")
      .withIndex("by_targetDocumentId", (q) =>
        q.eq("targetDocumentId", documentId),
      )
      .take(remainingBudget);
    for (const row of rows) {
      await ctx.db.delete(row._id);
      remainingBudget--;
      deleted++;
    }
  }

  const remaining = await hasRemainingLinksForDoc(ctx, documentId);
  return { deleted, remaining };
}

export async function hasRemainingLinksForDoc(
  ctx: MutationCtx,
  documentId: Id<"documents">,
): Promise<boolean> {
  const [asSource, asTarget] = await Promise.all([
    ctx.db
      .query("document_links")
      .withIndex("by_sourceDocumentId", (q) =>
        q.eq("sourceDocumentId", documentId),
      )
      .take(1),
    ctx.db
      .query("document_links")
      .withIndex("by_targetDocumentId", (q) =>
        q.eq("targetDocumentId", documentId),
      )
      .take(1),
  ]);
  return asSource.length > 0 || asTarget.length > 0;
}
