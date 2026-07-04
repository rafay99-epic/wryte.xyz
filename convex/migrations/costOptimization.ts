/**
 * Admin data migrations for the Convex bandwidth-cost optimization
 * (see `.frugal-fable/convex-cost-audit/DESIGN.md` → "Migration").
 *
 * Each concern is one admin `action` that drives a paginated
 * `internalMutation` chunk-by-chunk to completion — the exact pattern
 * established by `migrations/contentBackfill.ts`: idempotent, resumable
 * (a re-run after hitting the per-invocation chunk cap simply resumes),
 * and returning a human-readable final count to the migrations UI.
 *
 * These are the widen → **migrate** step of a widen/migrate/narrow rollout.
 * Narrowing (dropping the legacy optional fields) is a later release — this
 * file never removes a legacy field from the schema, it only drains the data
 * off it. Every migration skips rows that are already migrated and, where a
 * newer content row may already exist (autosave races), never clobbers it.
 *
 * Chunk sizes are kept small on tables whose rows still carry full bodies
 * pre-migration (Convex bills every read at the full row size), so a single
 * transaction's read/write bandwidth stays comfortably bounded.
 */
import { v } from "convex/values";
import { internal } from "../_generated/api";
import { action, internalMutation } from "../_generated/server";
import { requireAdmin } from "../_lib/admin";
import { contentHash } from "../_lib/contentHash";
import { getRateLimitKey, rateLimiter } from "../_lib/rateLimits";
import { countWords } from "../_lib/wordCount";
import { buildExcerpt, writeContent } from "../cms/_lib/documentContent";

/** Continuation cap per action invocation — mirrors `contentBackfill.ts`. */
const MAX_CHUNKS = 1000;

/** Shared shape returned by every paginated chunk mutation below. */
type ChunkResult = {
  migrated: number;
  scanned: number;
  isDone: boolean;
  cursor: string | null;
};

const cursorArg = { cursor: v.optional(v.union(v.string(), v.null())) };

/* ==================================================================== */
/*  1. Backfill `documents.contentId` (+ drain any legacy inline body)   */
/* ==================================================================== */

/**
 * Documents still carry full inline bodies on un-migrated rows, so keep the
 * chunk small — each drained row reads AND rewrites a full body.
 */
const DOCUMENT_CONTENT_ID_CHUNK = 25;

/**
 * One resumable chunk of the `documents.contentId` backfill.
 *
 * For every document missing its `contentId` pointer we point it at the
 * existing `document_content` row (found via `by_documentId`). If the row
 * still carries a legacy inline `content`, we ALSO drain it into
 * `document_content` — subsuming `cms/documents._backfillDocumentContent`
 * so a single pass leaves the row fully migrated (pointer set, inline body
 * cleared, excerpt/wordCount stamped). Documents with neither a pointer nor
 * a content row are skipped: `writeContent`'s fallback self-heals them on
 * the next save. Idempotent — fully-migrated rows are skipped.
 */
export const _backfillDocumentContentIds = internalMutation({
  args: cursorArg,
  handler: async (ctx, args): Promise<ChunkResult> => {
    const result = await ctx.db.query("documents").paginate({
      numItems: DOCUMENT_CONTENT_ID_CHUNK,
      cursor: args.cursor ?? null,
    });
    let migrated = 0;
    for (const doc of result.page) {
      // Fully migrated already: has a pointer and no legacy inline body.
      if (doc.contentId !== undefined && doc.content === undefined) continue;

      if (doc.content !== undefined) {
        // Legacy inline body present — drain it (subsumes
        // `_backfillDocumentContent`) and stamp the pointer in one patch.
        const content = doc.content;
        const contentId = await writeContent(ctx, {
          documentId: doc._id,
          projectId: doc.projectId,
          userId: doc.userId,
          content,
          ...(doc.contentId ? { contentId: doc.contentId } : {}),
        });
        await ctx.db.patch(doc._id, {
          excerpt: buildExcerpt(content),
          wordCount: doc.wordCount ?? countWords(content),
          content: undefined,
          ...(doc.contentId === undefined ? { contentId } : {}),
        });
        migrated += 1;
        continue;
      }

      // No inline body but no pointer: adopt the existing content row if one
      // exists. Otherwise skip — nothing to point at (self-heals on save).
      const row = await ctx.db
        .query("document_content")
        .withIndex("by_documentId", (q) => q.eq("documentId", doc._id))
        .unique();
      if (row) {
        await ctx.db.patch(doc._id, { contentId: row._id });
        migrated += 1;
      }
    }
    return {
      migrated,
      scanned: result.page.length,
      isDone: result.isDone,
      cursor: result.continueCursor,
    };
  },
});

export const migrateDocumentContentIds = action({
  args: {},
  handler: async (ctx): Promise<{ status: string; details: string }> => {
    const key = await getRateLimitKey(ctx);
    await rateLimiter.limit(ctx, "migrations:run", { key, throws: true });
    await requireAdmin(ctx);

    let cursor: string | null = null;
    let migrated = 0;
    let scanned = 0;
    let chunks = 0;
    let isDone = false;

    while (chunks < MAX_CHUNKS) {
      const res: ChunkResult = await ctx.runMutation(
        internal.migrations.costOptimization._backfillDocumentContentIds,
        { cursor },
      );
      migrated += res.migrated;
      scanned += res.scanned;
      chunks += 1;
      if (res.isDone) {
        isDone = true;
        break;
      }
      cursor = res.cursor;
    }

    const rows = `${String(migrated)} ${migrated === 1 ? "document" : "documents"}`;
    return {
      status: "ok",
      details: isDone
        ? `Backfilled contentId on ${rows} (${String(scanned)} scanned). Complete.`
        : `Backfilled ${rows} so far (${String(scanned)} scanned); more remain — run again to continue.`,
    };
  },
});

/* ==================================================================== */
/*  2. Drain draft snapshots → `document_draft_content`                  */
/* ==================================================================== */

/** Drafts carry inline bodies pre-migration — keep the chunk small. */
const DRAFT_CONTENT_CHUNK = 15;

/**
 * One resumable chunk of the draft-body drain. For every draft with an
 * inline `contentSnapshot`/`titleSnapshot` (or a missing `contentId`), we
 * ensure a `document_draft_content` row exists and clear the legacy inline
 * fields.
 *
 * Never-clobber: if the draft already has a content row (an autosave may
 * have written newer content there since the split shipped), we only adopt
 * its id — we do NOT overwrite it with the stale legacy snapshot. A row is
 * created only when none exists yet. Idempotent — already-migrated drafts
 * (no inline fields, pointer set) are skipped.
 */
export const _drainDraftContent = internalMutation({
  args: cursorArg,
  handler: async (ctx, args): Promise<ChunkResult> => {
    const result = await ctx.db.query("document_drafts").paginate({
      numItems: DRAFT_CONTENT_CHUNK,
      cursor: args.cursor ?? null,
    });
    let migrated = 0;
    for (const draft of result.page) {
      const needsMigration =
        draft.contentSnapshot !== undefined ||
        draft.titleSnapshot !== undefined ||
        draft.contentId === undefined;
      if (!needsMigration) continue;

      const existing = await ctx.db
        .query("document_draft_content")
        .withIndex("by_draftId", (q) => q.eq("draftId", draft._id))
        .unique();

      let contentId = existing?._id;
      if (contentId === undefined) {
        contentId = await ctx.db.insert("document_draft_content", {
          draftId: draft._id,
          documentId: draft.documentId,
          projectId: draft.projectId,
          userId: draft.userId,
          title: draft.titleSnapshot ?? "",
          content: draft.contentSnapshot ?? "",
          updatedAt: Date.now(),
        });
      }
      await ctx.db.patch(draft._id, {
        contentId,
        contentSnapshot: undefined,
        titleSnapshot: undefined,
      });
      migrated += 1;
    }
    return {
      migrated,
      scanned: result.page.length,
      isDone: result.isDone,
      cursor: result.continueCursor,
    };
  },
});

export const migrateDraftContent = action({
  args: {},
  handler: async (ctx): Promise<{ status: string; details: string }> => {
    const key = await getRateLimitKey(ctx);
    await rateLimiter.limit(ctx, "migrations:run", { key, throws: true });
    await requireAdmin(ctx);

    let cursor: string | null = null;
    let migrated = 0;
    let scanned = 0;
    let chunks = 0;
    let isDone = false;

    while (chunks < MAX_CHUNKS) {
      const res: ChunkResult = await ctx.runMutation(
        internal.migrations.costOptimization._drainDraftContent,
        { cursor },
      );
      migrated += res.migrated;
      scanned += res.scanned;
      chunks += 1;
      if (res.isDone) {
        isDone = true;
        break;
      }
      cursor = res.cursor;
    }

    const rows = `${String(migrated)} ${migrated === 1 ? "draft" : "drafts"}`;
    return {
      status: "ok",
      details: isDone
        ? `Drained ${rows} into document_draft_content (${String(scanned)} scanned). Complete.`
        : `Drained ${rows} so far (${String(scanned)} scanned); more remain — run again to continue.`,
    };
  },
});

/* ==================================================================== */
/*  3. Drain snapshot bodies → `document_snapshot_content` (+contentHash) */
/* ==================================================================== */

/** Snapshots carry inline bodies pre-migration — keep the chunk small. */
const SNAPSHOT_CONTENT_CHUNK = 15;

/**
 * One resumable chunk of the snapshot-body drain. For every snapshot with
 * an inline `content`, we insert its body into `document_snapshot_content`
 * and patch the metadata row to drop the body while stamping the cheap
 * `contentHash` dedup fingerprint. Never-clobber: if a content row already
 * exists we skip the insert (snapshot bodies are immutable, so this only
 * guards double-runs). Idempotent — already-drained rows are skipped.
 */
export const _drainSnapshotContent = internalMutation({
  args: cursorArg,
  handler: async (ctx, args): Promise<ChunkResult> => {
    const result = await ctx.db.query("document_snapshots").paginate({
      numItems: SNAPSHOT_CONTENT_CHUNK,
      cursor: args.cursor ?? null,
    });
    let migrated = 0;
    for (const snap of result.page) {
      if (snap.content === undefined) continue;
      const content = snap.content;

      const existing = await ctx.db
        .query("document_snapshot_content")
        .withIndex("by_snapshotId", (q) => q.eq("snapshotId", snap._id))
        .unique();
      if (!existing) {
        await ctx.db.insert("document_snapshot_content", {
          snapshotId: snap._id,
          documentId: snap.documentId,
          projectId: snap.projectId,
          userId: snap.userId,
          content,
        });
      }
      await ctx.db.patch(snap._id, {
        content: undefined,
        contentHash: contentHash(content),
      });
      migrated += 1;
    }
    return {
      migrated,
      scanned: result.page.length,
      isDone: result.isDone,
      cursor: result.continueCursor,
    };
  },
});

export const migrateSnapshotContent = action({
  args: {},
  handler: async (ctx): Promise<{ status: string; details: string }> => {
    const key = await getRateLimitKey(ctx);
    await rateLimiter.limit(ctx, "migrations:run", { key, throws: true });
    await requireAdmin(ctx);

    let cursor: string | null = null;
    let migrated = 0;
    let scanned = 0;
    let chunks = 0;
    let isDone = false;

    while (chunks < MAX_CHUNKS) {
      const res: ChunkResult = await ctx.runMutation(
        internal.migrations.costOptimization._drainSnapshotContent,
        { cursor },
      );
      migrated += res.migrated;
      scanned += res.scanned;
      chunks += 1;
      if (res.isDone) {
        isDone = true;
        break;
      }
      cursor = res.cursor;
    }

    const rows = `${String(migrated)} ${migrated === 1 ? "snapshot" : "snapshots"}`;
    return {
      status: "ok",
      details: isDone
        ? `Drained ${rows} into document_snapshot_content (${String(scanned)} scanned). Complete.`
        : `Drained ${rows} so far (${String(scanned)} scanned); more remain — run again to continue.`,
    };
  },
});

/* ==================================================================== */
/*  4. Drain publish bodies → `publish_history_content` + prune to 50    */
/* ==================================================================== */

/** Publish-history rows carry inline bodies pre-migration — small chunk. */
const PUBLISH_CONTENT_CHUNK = 15;
/** Prune runs after the drain, so these rows are tiny — a larger scan is
 *  cheap. Bounds how many distinct documents one prune chunk considers. */
const PUBLISH_PRUNE_SCAN_CHUNK = 50;
/** Newest N publish-history rows kept per document; older ones are pruned. */
const PUBLISH_HISTORY_CAP = 50;
/** Max stale rows deleted per document per prune chunk (bounds work; a
 *  document with a huge history is drained over successive re-runs). */
const PUBLISH_PRUNE_DELETE_BATCH = 40;

/**
 * One resumable chunk of the publish-body drain. For every publish-history
 * row with an inline `contentSnapshot`, we insert its body (and a copy of
 * `frontmatterSnapshot`) into `publish_history_content` and clear only the
 * inline body. `frontmatterSnapshot` is intentionally KEPT on the metadata
 * row: `cms/documents.rollbackToVersion` reads it as the migration-window
 * fallback (`contentRow?.frontmatter ?? historyEntry.frontmatterSnapshot`),
 * so removing it here would break rollback on rows this migration hasn't
 * reached yet. Never-clobber: skip the insert if a content row exists.
 */
export const _drainPublishHistoryContent = internalMutation({
  args: cursorArg,
  handler: async (ctx, args): Promise<ChunkResult> => {
    const result = await ctx.db.query("publish_history").paginate({
      numItems: PUBLISH_CONTENT_CHUNK,
      cursor: args.cursor ?? null,
    });
    let migrated = 0;
    for (const entry of result.page) {
      if (entry.contentSnapshot === undefined) continue;
      const content = entry.contentSnapshot;

      const existing = await ctx.db
        .query("publish_history_content")
        .withIndex("by_publishId", (q) => q.eq("publishId", entry._id))
        .unique();
      if (!existing) {
        await ctx.db.insert("publish_history_content", {
          publishId: entry._id,
          documentId: entry.documentId,
          projectId: entry.projectId,
          userId: entry.userId,
          content,
          ...(entry.frontmatterSnapshot !== undefined
            ? { frontmatter: entry.frontmatterSnapshot }
            : {}),
        });
      }
      // Keep `frontmatterSnapshot` — see the rollback fallback noted above.
      await ctx.db.patch(entry._id, { contentSnapshot: undefined });
      migrated += 1;
    }
    return {
      migrated,
      scanned: result.page.length,
      isDone: result.isDone,
      cursor: result.continueCursor,
    };
  },
});

/**
 * One resumable chunk of the publish-history prune. Runs AFTER the drain, so
 * the rows it scans are tiny. For each distinct document seen in the page,
 * if it has more than `PUBLISH_HISTORY_CAP` publish-history rows, delete the
 * oldest beyond the cap (and their `publish_history_content` rows). Bounded
 * per document per chunk; a document with a very long history is pruned over
 * successive re-runs. Idempotent — documents already at/under the cap are
 * skipped.
 */
export const _prunePublishHistory = internalMutation({
  args: cursorArg,
  handler: async (ctx, args): Promise<ChunkResult> => {
    const result = await ctx.db.query("publish_history").paginate({
      numItems: PUBLISH_PRUNE_SCAN_CHUNK,
      cursor: args.cursor ?? null,
    });
    let pruned = 0;
    const seen = new Set<string>();
    for (const entry of result.page) {
      if (seen.has(entry.documentId)) continue;
      seen.add(entry.documentId);

      // Newest rows are the keepers; take one past the cap to detect overflow.
      const newest = await ctx.db
        .query("publish_history")
        .withIndex("by_documentId", (q) => q.eq("documentId", entry.documentId))
        .order("desc")
        .take(PUBLISH_HISTORY_CAP + 1);
      const oldestKeeper = newest[PUBLISH_HISTORY_CAP - 1];
      if (newest.length <= PUBLISH_HISTORY_CAP || oldestKeeper === undefined) {
        continue;
      }

      // Everything older than the oldest keeper is stale (index trails by
      // `_creationTime`, so the range is served without a scan).
      const cutoff = oldestKeeper._creationTime;
      const stale = await ctx.db
        .query("publish_history")
        .withIndex("by_documentId", (q) =>
          q.eq("documentId", entry.documentId).lt("_creationTime", cutoff),
        )
        .order("asc")
        .take(PUBLISH_PRUNE_DELETE_BATCH);
      for (const old of stale) {
        const body = await ctx.db
          .query("publish_history_content")
          .withIndex("by_publishId", (q) => q.eq("publishId", old._id))
          .unique();
        if (body) await ctx.db.delete(body._id);
        await ctx.db.delete(old._id);
        pruned += 1;
      }
    }
    return {
      migrated: pruned,
      scanned: result.page.length,
      isDone: result.isDone,
      cursor: result.continueCursor,
    };
  },
});

export const migratePublishHistoryContent = action({
  args: {},
  handler: async (ctx): Promise<{ status: string; details: string }> => {
    const key = await getRateLimitKey(ctx);
    await rateLimiter.limit(ctx, "migrations:run", { key, throws: true });
    await requireAdmin(ctx);

    // Phase 1 — drain bodies out of the metadata rows.
    let cursor: string | null = null;
    let drained = 0;
    let scanned = 0;
    let chunks = 0;
    let drainDone = false;
    while (chunks < MAX_CHUNKS) {
      const res: ChunkResult = await ctx.runMutation(
        internal.migrations.costOptimization._drainPublishHistoryContent,
        { cursor },
      );
      drained += res.migrated;
      scanned += res.scanned;
      chunks += 1;
      if (res.isDone) {
        drainDone = true;
        break;
      }
      cursor = res.cursor;
    }

    // Phase 2 — prune to the cap (only once the drain is complete, so the
    // prune scans tiny rows). If the drain didn't finish this invocation,
    // defer pruning to a re-run rather than pruning heavy un-drained rows.
    let pruned = 0;
    let pruneDone = false;
    if (drainDone) {
      cursor = null;
      chunks = 0;
      while (chunks < MAX_CHUNKS) {
        const res: ChunkResult = await ctx.runMutation(
          internal.migrations.costOptimization._prunePublishHistory,
          { cursor },
        );
        pruned += res.migrated;
        chunks += 1;
        if (res.isDone) {
          pruneDone = true;
          break;
        }
        cursor = res.cursor;
      }
    }

    const bodies = `${String(drained)} ${drained === 1 ? "body" : "bodies"}`;
    const cap = `${String(pruned)} pruned`;
    return {
      status: "ok",
      details:
        drainDone && pruneDone
          ? `Drained ${bodies} into publish_history_content, ${cap} beyond cap (${String(scanned)} scanned). Complete.`
          : `Drained ${bodies} so far (${String(scanned)} scanned); more remain — run again to finish draining and pruning.`,
    };
  },
});

/* ==================================================================== */
/*  5. Strip content off resolved `sync_conflicts`                       */
/* ==================================================================== */

/** Unresolved rows still carry up to 2× full body — keep the chunk small. */
const CONFLICT_STRIP_CHUNK = 15;

/**
 * One resumable chunk of the resolved-conflict strip. For every resolved
 * `sync_conflicts` row that still carries any of its four content fields,
 * patch them to `undefined` — resolution keeps only tiny audit metadata.
 * Idempotent — unresolved rows and already-stripped rows are skipped.
 */
export const _stripResolvedConflicts = internalMutation({
  args: cursorArg,
  handler: async (ctx, args): Promise<ChunkResult> => {
    const result = await ctx.db.query("sync_conflicts").paginate({
      numItems: CONFLICT_STRIP_CHUNK,
      cursor: args.cursor ?? null,
    });
    let migrated = 0;
    for (const row of result.page) {
      if (row.resolvedAt === undefined) continue;
      const hasContent =
        row.remoteContent !== undefined ||
        row.remoteFrontmatter !== undefined ||
        row.localContentSnapshot !== undefined ||
        row.localFrontmatterSnapshot !== undefined;
      if (!hasContent) continue;
      await ctx.db.patch(row._id, {
        remoteContent: undefined,
        remoteFrontmatter: undefined,
        localContentSnapshot: undefined,
        localFrontmatterSnapshot: undefined,
      });
      migrated += 1;
    }
    return {
      migrated,
      scanned: result.page.length,
      isDone: result.isDone,
      cursor: result.continueCursor,
    };
  },
});

export const stripResolvedConflicts = action({
  args: {},
  handler: async (ctx): Promise<{ status: string; details: string }> => {
    const key = await getRateLimitKey(ctx);
    await rateLimiter.limit(ctx, "migrations:run", { key, throws: true });
    await requireAdmin(ctx);

    let cursor: string | null = null;
    let migrated = 0;
    let scanned = 0;
    let chunks = 0;
    let isDone = false;

    while (chunks < MAX_CHUNKS) {
      const res: ChunkResult = await ctx.runMutation(
        internal.migrations.costOptimization._stripResolvedConflicts,
        { cursor },
      );
      migrated += res.migrated;
      scanned += res.scanned;
      chunks += 1;
      if (res.isDone) {
        isDone = true;
        break;
      }
      cursor = res.cursor;
    }

    const rows = `${String(migrated)} resolved ${migrated === 1 ? "conflict" : "conflicts"}`;
    return {
      status: "ok",
      details: isDone
        ? `Stripped content from ${rows} (${String(scanned)} scanned). Complete.`
        : `Stripped ${rows} so far (${String(scanned)} scanned); more remain — run again to continue.`,
    };
  },
});

/* ==================================================================== */
/*  6. Purge orphaned artifacts (parent document deleted)                */
/* ==================================================================== */

/**
 * Tables whose rows point back at a `documents` row. When that parent was
 * hard-deleted before the cascade fix shipped, these rows were orphaned
 * forever. We paginate each table, and delete any row whose parent document
 * no longer exists. Per-table chunk sizes are smaller on tables that may
 * still carry full bodies pre-migration.
 */
const ORPHAN_TABLES = [
  "document_drafts",
  "document_snapshots",
  "sync_conflicts",
  "publish_history",
  "document_draft_content",
  "document_snapshot_content",
  "publish_history_content",
  "document_research",
  "share_links",
] as const;

const orphanTableValidator = v.union(
  v.literal("document_drafts"),
  v.literal("document_snapshots"),
  v.literal("sync_conflicts"),
  v.literal("publish_history"),
  v.literal("document_draft_content"),
  v.literal("document_snapshot_content"),
  v.literal("publish_history_content"),
  v.literal("document_research"),
  v.literal("share_links"),
);

type OrphanTable = (typeof ORPHAN_TABLES)[number];

const ORPHAN_CHUNK: Record<OrphanTable, number> = {
  document_drafts: 15,
  document_snapshots: 15,
  sync_conflicts: 15,
  publish_history: 15,
  document_draft_content: 15,
  document_snapshot_content: 15,
  publish_history_content: 15,
  document_research: 20,
  share_links: 50,
};

/**
 * One resumable chunk of the orphan purge for a single table. Reads a page,
 * checks each row's parent document via `ctx.db.get`, and deletes rows whose
 * parent is gone. The per-table branch keeps the query fully typed (Convex's
 * `query` needs a concrete table literal); the delete loop is otherwise
 * identical across tables.
 */
export const _purgeOrphanChunk = internalMutation({
  args: { table: orphanTableValidator, ...cursorArg },
  handler: async (ctx, args): Promise<ChunkResult> => {
    const cursor = args.cursor ?? null;
    const numItems = ORPHAN_CHUNK[args.table];
    let deleted = 0;
    let scanned = 0;
    let isDone = true;
    let continueCursor: string | null = null;

    switch (args.table) {
      case "document_drafts": {
        const r = await ctx.db
          .query("document_drafts")
          .paginate({ numItems, cursor });
        for (const row of r.page) {
          if ((await ctx.db.get(row.documentId)) === null) {
            await ctx.db.delete(row._id);
            deleted += 1;
          }
        }
        scanned = r.page.length;
        isDone = r.isDone;
        continueCursor = r.continueCursor;
        break;
      }
      case "document_snapshots": {
        const r = await ctx.db
          .query("document_snapshots")
          .paginate({ numItems, cursor });
        for (const row of r.page) {
          if ((await ctx.db.get(row.documentId)) === null) {
            await ctx.db.delete(row._id);
            deleted += 1;
          }
        }
        scanned = r.page.length;
        isDone = r.isDone;
        continueCursor = r.continueCursor;
        break;
      }
      case "sync_conflicts": {
        const r = await ctx.db
          .query("sync_conflicts")
          .paginate({ numItems, cursor });
        for (const row of r.page) {
          if ((await ctx.db.get(row.documentId)) === null) {
            await ctx.db.delete(row._id);
            deleted += 1;
          }
        }
        scanned = r.page.length;
        isDone = r.isDone;
        continueCursor = r.continueCursor;
        break;
      }
      case "publish_history": {
        const r = await ctx.db
          .query("publish_history")
          .paginate({ numItems, cursor });
        for (const row of r.page) {
          if ((await ctx.db.get(row.documentId)) === null) {
            await ctx.db.delete(row._id);
            deleted += 1;
          }
        }
        scanned = r.page.length;
        isDone = r.isDone;
        continueCursor = r.continueCursor;
        break;
      }
      case "document_draft_content": {
        const r = await ctx.db
          .query("document_draft_content")
          .paginate({ numItems, cursor });
        for (const row of r.page) {
          if ((await ctx.db.get(row.documentId)) === null) {
            await ctx.db.delete(row._id);
            deleted += 1;
          }
        }
        scanned = r.page.length;
        isDone = r.isDone;
        continueCursor = r.continueCursor;
        break;
      }
      case "document_snapshot_content": {
        const r = await ctx.db
          .query("document_snapshot_content")
          .paginate({ numItems, cursor });
        for (const row of r.page) {
          if ((await ctx.db.get(row.documentId)) === null) {
            await ctx.db.delete(row._id);
            deleted += 1;
          }
        }
        scanned = r.page.length;
        isDone = r.isDone;
        continueCursor = r.continueCursor;
        break;
      }
      case "publish_history_content": {
        const r = await ctx.db
          .query("publish_history_content")
          .paginate({ numItems, cursor });
        for (const row of r.page) {
          if ((await ctx.db.get(row.documentId)) === null) {
            await ctx.db.delete(row._id);
            deleted += 1;
          }
        }
        scanned = r.page.length;
        isDone = r.isDone;
        continueCursor = r.continueCursor;
        break;
      }
      case "document_research": {
        const r = await ctx.db
          .query("document_research")
          .paginate({ numItems, cursor });
        for (const row of r.page) {
          if ((await ctx.db.get(row.documentId)) === null) {
            await ctx.db.delete(row._id);
            deleted += 1;
          }
        }
        scanned = r.page.length;
        isDone = r.isDone;
        continueCursor = r.continueCursor;
        break;
      }
      case "share_links": {
        const r = await ctx.db
          .query("share_links")
          .paginate({ numItems, cursor });
        for (const row of r.page) {
          if ((await ctx.db.get(row.documentId)) === null) {
            await ctx.db.delete(row._id);
            deleted += 1;
          }
        }
        scanned = r.page.length;
        isDone = r.isDone;
        continueCursor = r.continueCursor;
        break;
      }
    }

    return { migrated: deleted, scanned, isDone, cursor: continueCursor };
  },
});

export const purgeOrphanedArtifacts = action({
  args: {},
  handler: async (ctx): Promise<{ status: string; details: string }> => {
    const key = await getRateLimitKey(ctx);
    await rateLimiter.limit(ctx, "migrations:run", { key, throws: true });
    await requireAdmin(ctx);

    let deleted = 0;
    let scanned = 0;
    let allDone = true;

    for (const table of ORPHAN_TABLES) {
      let cursor: string | null = null;
      let chunks = 0;
      let tableDone = false;
      while (chunks < MAX_CHUNKS) {
        const res: ChunkResult = await ctx.runMutation(
          internal.migrations.costOptimization._purgeOrphanChunk,
          { table, cursor },
        );
        deleted += res.migrated;
        scanned += res.scanned;
        chunks += 1;
        if (res.isDone) {
          tableDone = true;
          break;
        }
        cursor = res.cursor;
      }
      if (!tableDone) allDone = false;
    }

    const rows = `${String(deleted)} orphaned ${deleted === 1 ? "row" : "rows"}`;
    return {
      status: "ok",
      details: allDone
        ? `Purged ${rows} across ${String(ORPHAN_TABLES.length)} tables (${String(scanned)} scanned). Complete.`
        : `Purged ${rows} so far (${String(scanned)} scanned); more remain — run again to continue.`,
    };
  },
});
