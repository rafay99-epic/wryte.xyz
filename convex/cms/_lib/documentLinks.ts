/**
 * Single source of truth for maintaining the `document_links` graph — the
 * directed `[[wiki link]]` edges behind the editor's "Linked from" (backlinks)
 * panel.
 *
 * Maintenance is FLUSH-ONLY. `syncDocumentLinks` is invoked exclusively from
 * the coarse save/flush mutations (`documents.update` when content is
 * provided, `documentDrafts.promoteToMain`, `snapshots.restore`, and the
 * conflict resolutions that replace main content) — NEVER from the 3s
 * `autosaveBody` hot path. That discipline is what keeps the (relatively
 * expensive) target-resolution read — a bounded `.take(RESOLVE_SCAN_CAP)`
 * over the project's document metadata — off the per-keystroke path.
 *
 * The parse mirrors the pre-publish checklist's `[[Target]]` / `[[Target|alias]]`
 * detection (see `src/features/editor/lib/publish-checklist.ts`): fenced and
 * inline code are stripped so example snippets never register as links, and a
 * target resolves against a same-project document by case-insensitive exact
 * title OR slug match. Self-links and unresolved targets are dropped — the
 * pre-publish checklist already surfaces unresolved links to the author.
 */
import type { Doc, Id } from "../../_generated/dataModel";
import type { MutationCtx } from "../../_generated/server";

/** Fenced code-block delimiter (``` or ~~~) at the start of a trimmed line. */
const FENCE_LINE_RE = /^(```|~~~)/;
/** `[[Target]]` or `[[Target|display]]` — same shape the checklist trusts. */
const WIKI_LINK_RE = /\[\[([^\]\n]+)\]\]/g;
/** Inline code spans — blanked so `[[x]]` inside `code` never counts. */
const INLINE_CODE_RE = /`[^`\n]*`/g;

/**
 * Upper bound on how many project documents we load to resolve link targets,
 * and how many existing edges we delete per source. Bounds the flush-path
 * cost even for pathological projects/documents; acceptable ONLY because this
 * runs on the flush cadence, not autosave.
 */
const RESOLVE_SCAN_CAP = 500;

/**
 * Blank out fenced code blocks (and inline code spans) so `[[links]]` inside
 * example snippets aren't treated as real wiki links. Mirrors
 * `stripFencedCode` in the pre-publish checklist, plus inline-code stripping.
 */
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

/**
 * Extracts the deduped list of `[[wiki link]]` target strings from a body,
 * ignoring fenced/inline code. `[[Target|display]]` resolves against the
 * target. Order-preserving; case-insensitive dedupe.
 */
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

/**
 * Recomputes the `document_links` rows for a single source document: deletes
 * the source's existing edges, then inserts one edge per resolved, non-self,
 * distinct target found in `content`.
 *
 * Target resolution reads the project's document metadata via the
 * `by_projectId` index, bounded to `RESOLVE_SCAN_CAP` rows — acceptable ONLY
 * on the flush cadence (see the module doc-comment). Trashed documents are
 * excluded as link targets.
 */
export async function syncDocumentLinks(
  ctx: MutationCtx,
  doc: Doc<"documents">,
  content: string,
): Promise<void> {
  // 1. Drop the source's current edges. Bounded take() keeps a single
  //    transaction safe even for a document with a huge link list.
  const existing = await ctx.db
    .query("document_links")
    .withIndex("by_sourceDocumentId", (q) => q.eq("sourceDocumentId", doc._id))
    .take(RESOLVE_SCAN_CAP);
  for (const row of existing) {
    await ctx.db.delete(row._id);
  }

  const targets = extractWikiTargets(content);
  if (targets.length === 0) return;

  // 2. Build a case-insensitive title/slug → id resolution map from the
  //    project's (non-trashed) documents. First writer wins on key
  //    collisions; the source itself is never a resolution target.
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

  // 3. Insert one edge per distinct resolved target (two different strings —
  //    a title and a slug — can resolve to the same doc; dedupe by id).
  const now = Date.now();
  const linked = new Set<Id<"documents">>();
  for (const target of targets) {
    const targetId = byKey.get(target.toLowerCase());
    if (!targetId) continue; // unresolved — surfaced by the publish checklist
    if (targetId === doc._id) continue; // defensive: never self-link
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

/**
 * Drains every `document_links` edge touching `documentId` in BOTH directions
 * (rows where it is the source and rows where it is the target), sharing the
 * caller's remaining per-transaction budget. Returns the number deleted and
 * whether any edges remain. Used by the per-document purge cascade.
 */
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

/** Cheap `.take(1)` existence check in both link directions for `done`. */
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
