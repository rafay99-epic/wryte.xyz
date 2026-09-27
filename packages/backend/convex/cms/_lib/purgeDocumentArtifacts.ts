import type { Id } from "../../_generated/dataModel";
import type { MutationCtx } from "../../_generated/server";
import {
  drainDocumentLinksForDoc,
  hasRemainingLinksForDoc,
} from "./documentLinks";

const PER_CALL_CAP = 200;

export async function purgeDocumentArtifacts(
  ctx: MutationCtx,
  documentId: Id<"documents">,
  cap: number = PER_CALL_CAP,
): Promise<{ done: boolean; deleted: number }> {
  let budget = Math.max(0, Math.min(cap, PER_CALL_CAP));
  let deleted = 0;

  if (budget > 0) {
    const rows = await ctx.db
      .query("document_draft_content")
      .withIndex("by_documentId", (q) => q.eq("documentId", documentId))
      .take(budget);
    for (const row of rows) {
      await ctx.db.delete(row._id);
      budget--;
      deleted++;
    }
  }

  if (budget > 0) {
    const rows = await ctx.db
      .query("document_drafts")
      .withIndex("by_documentId", (q) => q.eq("documentId", documentId))
      .take(budget);
    for (const row of rows) {
      await ctx.db.delete(row._id);
      budget--;
      deleted++;
    }
  }

  if (budget > 0) {
    const rows = await ctx.db
      .query("document_snapshot_content")
      .withIndex("by_documentId", (q) => q.eq("documentId", documentId))
      .take(budget);
    for (const row of rows) {
      await ctx.db.delete(row._id);
      budget--;
      deleted++;
    }
  }

  if (budget > 0) {
    const rows = await ctx.db
      .query("document_snapshots")
      .withIndex("by_documentId", (q) => q.eq("documentId", documentId))
      .take(budget);
    for (const row of rows) {
      await ctx.db.delete(row._id);
      budget--;
      deleted++;
    }
  }

  if (budget > 0) {
    const rows = await ctx.db
      .query("sync_conflicts")
      .withIndex("by_documentId", (q) => q.eq("documentId", documentId))
      .take(budget);
    for (const row of rows) {
      await ctx.db.delete(row._id);
      budget--;
      deleted++;
    }
  }

  if (budget > 0) {
    const rows = await ctx.db
      .query("publish_history_content")
      .withIndex("by_documentId", (q) => q.eq("documentId", documentId))
      .take(budget);
    for (const row of rows) {
      await ctx.db.delete(row._id);
      budget--;
      deleted++;
    }
  }

  if (budget > 0) {
    const rows = await ctx.db
      .query("publish_history")
      .withIndex("by_documentId", (q) => q.eq("documentId", documentId))
      .take(budget);
    for (const row of rows) {
      await ctx.db.delete(row._id);
      budget--;
      deleted++;
    }
  }

  if (budget > 0) {
    const rows = await ctx.db
      .query("deploy_verifications")
      .withIndex("by_documentId", (q) => q.eq("documentId", documentId))
      .take(budget);
    for (const row of rows) {
      await ctx.db.delete(row._id);
      budget--;
      deleted++;
    }
  }

  if (budget > 0) {
    const rows = await ctx.db
      .query("document_research")
      .withIndex("by_documentId", (q) => q.eq("documentId", documentId))
      .take(budget);
    for (const row of rows) {
      await ctx.db.delete(row._id);
      budget--;
      deleted++;
    }
  }

  if (budget > 0) {
    const rows = await ctx.db
      .query("share_links")
      .withIndex("by_documentId", (q) => q.eq("documentId", documentId))
      .take(budget);
    for (const row of rows) {
      await ctx.db.delete(row._id);
      budget--;
      deleted++;
    }
  }

  if (budget > 0) {
    const rows = await ctx.db
      .query("scheduled_publishes")
      .withIndex("by_documentId", (q) => q.eq("documentId", documentId))
      .take(budget);
    for (const row of rows) {
      await ctx.db.delete(row._id);
      budget--;
      deleted++;
    }
  }

  if (budget > 0) {
    const { deleted: linksDeleted } = await drainDocumentLinksForDoc(
      ctx,
      documentId,
      budget,
    );
    budget -= linksDeleted;
    deleted += linksDeleted;
  }

  const done = !(await hasRemainingArtifacts(ctx, documentId));
  return { done, deleted };
}

async function hasRemainingArtifacts(
  ctx: MutationCtx,
  documentId: Id<"documents">,
): Promise<boolean> {
  const heads = await Promise.all([
    ctx.db
      .query("document_draft_content")
      .withIndex("by_documentId", (q) => q.eq("documentId", documentId))
      .take(1),
    ctx.db
      .query("document_drafts")
      .withIndex("by_documentId", (q) => q.eq("documentId", documentId))
      .take(1),
    ctx.db
      .query("document_snapshot_content")
      .withIndex("by_documentId", (q) => q.eq("documentId", documentId))
      .take(1),
    ctx.db
      .query("document_snapshots")
      .withIndex("by_documentId", (q) => q.eq("documentId", documentId))
      .take(1),
    ctx.db
      .query("sync_conflicts")
      .withIndex("by_documentId", (q) => q.eq("documentId", documentId))
      .take(1),
    ctx.db
      .query("publish_history_content")
      .withIndex("by_documentId", (q) => q.eq("documentId", documentId))
      .take(1),
    ctx.db
      .query("publish_history")
      .withIndex("by_documentId", (q) => q.eq("documentId", documentId))
      .take(1),
    ctx.db
      .query("deploy_verifications")
      .withIndex("by_documentId", (q) => q.eq("documentId", documentId))
      .take(1),
    ctx.db
      .query("document_research")
      .withIndex("by_documentId", (q) => q.eq("documentId", documentId))
      .take(1),
    ctx.db
      .query("share_links")
      .withIndex("by_documentId", (q) => q.eq("documentId", documentId))
      .take(1),
    ctx.db
      .query("scheduled_publishes")
      .withIndex("by_documentId", (q) => q.eq("documentId", documentId))
      .take(1),
  ]);
  if (heads.some((rows) => rows.length > 0)) return true;
  return await hasRemainingLinksForDoc(ctx, documentId);
}
