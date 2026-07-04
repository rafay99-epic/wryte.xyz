/**
 * TEMPORARY TEST HARNESS — for locally verifying the bandwidth-cost
 * optimization (content side-table splits + migrations). Delete after the
 * rollout is confirmed. Internal-only: driven via `bunx convex run` / the
 * MCP `run` tool against the LOCAL deployment; never exposed to clients.
 *
 *   _seed/costOptTest:seedLegacy   — creates a test user/project/documents
 *                                    shaped like PRE-migration data (inline
 *                                    bodies, no pointers, orphans, resolved
 *                                    conflicts still carrying content).
 *   _seed/costOptTest:inspect      — invariant checks + per-table byte
 *                                    accounting for the seeded project, so
 *                                    before/after migration can be compared.
 *   _seed/costOptTest:cleanup      — removes everything the seed created.
 */
import { v } from "convex/values";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { action, internalMutation } from "../_generated/server";
import { requireAdmin } from "../_lib/admin";
import { contentHash } from "../_lib/contentHash";
import { getRateLimitKey, rateLimiter } from "../_lib/rateLimits";
import { countWords } from "../_lib/wordCount";
import { buildExcerpt, writeContent } from "../cms/_lib/documentContent";
import { writeDraftContent } from "../cms/_lib/draftContent";
import { purgeDocumentArtifacts } from "../cms/_lib/purgeDocumentArtifacts";

const SEED_TOKEN = "seed|cost-opt-test";
const SEED_EMAIL = "cost-opt-test@example.com";

/** ~10KB of markdown-ish filler per article body. */
function makeContent(label: string, kb: number): string {
  const para = `## ${label}\n\nLorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. `;
  return para.repeat(Math.ceil((kb * 1024) / para.length));
}

export const seedLegacy = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();

    // Idempotency: refuse to double-seed.
    const existingUser = await ctx.db
      .query("users")
      .withIndex("by_tokenIdentifier", (q) =>
        q.eq("tokenIdentifier", SEED_TOKEN),
      )
      .unique();
    if (existingUser) {
      return { status: "already-seeded", hint: "run cleanup first" };
    }

    const userId = await ctx.db.insert("users", {
      tokenIdentifier: SEED_TOKEN,
      name: "Cost Opt Test",
      email: SEED_EMAIL,
      createdAt: now,
    });
    const projectId = await ctx.db.insert("projects", {
      userId,
      name: "Cost Opt Test Project",
      slug: "cost-opt-test",
      createdAt: now,
      updatedAt: now,
    });

    const content = makeContent("Main article", 10);

    // Doc A — fully legacy-shaped: inline body on the documents row, no
    // document_content row, no contentId. Exercises migration 1's drain.
    const docA = await ctx.db.insert("documents", {
      projectId,
      userId,
      title: "Doc A (legacy inline body)",
      slug: "doc-a",
      content,
      status: "draft",
      createdAt: now,
      updatedAt: now,
    });

    // Doc B — split body but missing the pointer (post-split, pre-pointer).
    const docB = await ctx.db.insert("documents", {
      projectId,
      userId,
      title: "Doc B (content row, no pointer)",
      slug: "doc-b",
      status: "draft",
      createdAt: now,
      updatedAt: now,
    });
    await ctx.db.insert("document_content", {
      documentId: docB,
      projectId,
      userId,
      content,
      updatedAt: now,
    });

    // Legacy drafts on doc A: inline contentSnapshot/titleSnapshot.
    for (let i = 1; i <= 5; i++) {
      await ctx.db.insert("document_drafts", {
        documentId: docA,
        projectId,
        userId,
        label: `Legacy draft ${String(i)}`,
        contentSnapshot: makeContent(`Draft ${String(i)}`, 8),
        titleSnapshot: `Draft ${String(i)} title`,
        wordCount: 1200,
        createdAt: now + i,
        updatedAt: now + i,
      });
    }

    // Legacy snapshots on doc A: inline content, no hash.
    for (let i = 1; i <= 10; i++) {
      await ctx.db.insert("document_snapshots", {
        documentId: docA,
        projectId,
        userId,
        reason: i % 2 ? "interval" : "manual",
        title: "Doc A",
        content: makeContent(`Snapshot ${String(i)}`, 8),
        wordCount: 1200,
        createdAt: now + i,
      });
    }

    // Legacy publish history on doc A: 60 entries with inline bodies —
    // exercises both the drain and the prune-to-50.
    for (let i = 1; i <= 60; i++) {
      await ctx.db.insert("publish_history", {
        documentId: docA,
        projectId,
        userId,
        commitSha: `sha-${String(i)}`,
        githubPath: "content/doc-a.md",
        commitMessage: `publish ${String(i)}`,
        contentSnapshot: makeContent(`Publish ${String(i)}`, 4),
        titleSnapshot: "Doc A",
        isUpdate: i > 1,
        createdAt: now + i,
      });
    }

    // Conflicts on doc A: one resolved (content should be stripped by
    // migration 5), one open (content must be PRESERVED).
    await ctx.db.insert("sync_conflicts", {
      projectId,
      documentId: docA,
      userId,
      githubPath: "content/doc-a.md",
      remoteSha: "sha-old",
      remoteContent: makeContent("Resolved remote", 6),
      localContentSnapshot: makeContent("Resolved local", 6),
      detectedAt: now - 1000,
      resolvedAt: now - 500,
      resolution: "github",
    });
    await ctx.db.insert("sync_conflicts", {
      projectId,
      documentId: docA,
      userId,
      githubPath: "content/doc-a.md",
      remoteSha: "sha-new",
      remoteContent: makeContent("Open remote", 6),
      localContentSnapshot: makeContent("Open local", 6),
      detectedAt: now,
    });

    // Doc C — created then hard-deleted the pre-fix way (row gone, children
    // left behind) to exercise migration 6's orphan purge.
    const docC = await ctx.db.insert("documents", {
      projectId,
      userId,
      title: "Doc C (to orphan)",
      slug: "doc-c",
      status: "draft",
      createdAt: now,
      updatedAt: now,
    });
    await ctx.db.insert("document_drafts", {
      documentId: docC,
      projectId,
      userId,
      label: "Orphan draft",
      contentSnapshot: makeContent("Orphan draft", 4),
      titleSnapshot: "Orphan",
      wordCount: 600,
      createdAt: now,
      updatedAt: now,
    });
    await ctx.db.insert("document_snapshots", {
      documentId: docC,
      projectId,
      userId,
      reason: "manual",
      title: "Orphan snap",
      content: makeContent("Orphan snap", 4),
      wordCount: 600,
      createdAt: now,
    });
    await ctx.db.insert("document_research", {
      documentId: docC,
      projectId,
      userId,
      type: "note",
      title: "Orphan research",
      content: "note body",
      selectedForAi: false,
      createdAt: now,
      updatedAt: now,
    });
    await ctx.db.delete(docC);

    return {
      status: "seeded",
      userId,
      projectId,
      docA,
      docB,
      orphanedDocId: docC,
    };
  },
});

/** Per-row JSON size (approximates Convex's billed document size). */
function rowBytes(row: unknown): number {
  return JSON.stringify(row).length;
}

export const inspect = internalMutation({
  args: {},
  handler: async (ctx) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_tokenIdentifier", (q) =>
        q.eq("tokenIdentifier", SEED_TOKEN),
      )
      .unique();
    if (!user) return { status: "not-seeded" };
    const project = await ctx.db
      .query("projects")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .unique();
    if (!project) return { status: "not-seeded" };

    const docs = await ctx.db
      .query("documents")
      .withIndex("by_projectId", (q) => q.eq("projectId", project._id))
      .take(100);

    const tally = (
      label: string,
      rows: unknown[],
    ): { table: string; rows: number; bytes: number } => ({
      table: label,
      rows: rows.length,
      bytes: rows.reduce((sum: number, r) => sum + rowBytes(r), 0),
    });

    const [drafts, draftContent, snaps, snapContent, publish, publishContent] =
      await Promise.all([
        ctx.db
          .query("document_drafts")
          .withIndex("by_projectId", (q) => q.eq("projectId", project._id))
          .take(500),
        ctx.db
          .query("document_draft_content")
          .withIndex("by_projectId", (q) => q.eq("projectId", project._id))
          .take(500),
        ctx.db
          .query("document_snapshots")
          .withIndex("by_projectId", (q) => q.eq("projectId", project._id))
          .take(500),
        ctx.db
          .query("document_snapshot_content")
          .withIndex("by_projectId", (q) => q.eq("projectId", project._id))
          .take(500),
        ctx.db
          .query("publish_history")
          .withIndex("by_projectId", (q) => q.eq("projectId", project._id))
          .take(500),
        ctx.db
          .query("publish_history_content")
          .withIndex("by_projectId", (q) => q.eq("projectId", project._id))
          .take(500),
      ]);
    const conflicts = await ctx.db
      .query("sync_conflicts")
      .withIndex("by_projectId", (q) => q.eq("projectId", project._id))
      .take(500);

    // Invariants that must hold POST-migration.
    const invariants = {
      allDocsHaveContentId: docs.every((d) => d.contentId !== undefined),
      noInlineDocBodies: docs.every((d) => d.content === undefined),
      noInlineDraftBodies: drafts.every(
        (d) => d.contentSnapshot === undefined && d.titleSnapshot === undefined,
      ),
      allDraftsHavePointer: drafts.every((d) => d.contentId !== undefined),
      draftContentRowsMatchDrafts: draftContent.length === drafts.length,
      noInlineSnapshotBodies: snaps.every((s) => s.content === undefined),
      allSnapshotsHaveHash: snaps.every((s) => s.contentHash !== undefined),
      snapContentRowsMatchSnaps: snapContent.length === snaps.length,
      noInlinePublishBodies: publish.every(
        (p) => p.contentSnapshot === undefined,
      ),
      publishPrunedToCap: publish.length <= 50,
      publishContentMatches: publishContent.length === publish.length,
      resolvedConflictsStripped: conflicts
        .filter((c) => c.resolvedAt !== undefined)
        .every(
          (c) =>
            c.remoteContent === undefined &&
            c.localContentSnapshot === undefined,
        ),
      openConflictsKeepContent: conflicts
        .filter((c) => c.resolvedAt === undefined)
        .every(
          (c) =>
            c.remoteContent !== undefined &&
            c.localContentSnapshot !== undefined,
        ),
      // Orphans (children of the deleted doc C) must be gone post-purge.
      orphanRows:
        drafts.filter((d) => docs.every((doc) => doc._id !== d.documentId))
          .length +
        snaps.filter((s) => docs.every((doc) => doc._id !== s.documentId))
          .length,
    };

    return {
      status: "ok",
      // What a `documentDrafts.list`-shaped subscription reads per re-run:
      // pre-migration this includes full bodies; post-migration metadata only.
      draftListReadSetBytes: drafts.reduce((sum, d) => sum + rowBytes(d), 0),
      publishListReadSetBytes: publish.reduce((sum, p) => sum + rowBytes(p), 0),
      snapshotListReadSetBytes: snaps.reduce((sum, s) => sum + rowBytes(s), 0),
      tables: [
        tally("documents", docs),
        tally("document_drafts", drafts),
        tally("document_draft_content", draftContent),
        tally("document_snapshots", snaps),
        tally("document_snapshot_content", snapContent),
        tally("publish_history", publish),
        tally("publish_history_content", publishContent),
        tally("sync_conflicts", conflicts),
      ],
      invariants,
    };
  },
});

export const cleanup = internalMutation({
  args: {},
  handler: async (ctx) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_tokenIdentifier", (q) =>
        q.eq("tokenIdentifier", SEED_TOKEN),
      )
      .unique();
    if (!user) return { status: "nothing-to-clean" };

    let deleted = 0;

    const project = await ctx.db
      .query("projects")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .unique();
    if (project) {
      // Seed volumes are bounded (< 200 rows/table), so single-pass drains
      // stay well inside transaction limits. Explicit per-table queries:
      // Convex's typed `db.query` doesn't accept a union of table names.
      const pid = project._id;
      const pages = [
        await ctx.db
          .query("document_research")
          .withIndex("by_projectId", (q) => q.eq("projectId", pid))
          .take(1000),
        await ctx.db
          .query("sync_conflicts")
          .withIndex("by_projectId", (q) => q.eq("projectId", pid))
          .take(1000),
        await ctx.db
          .query("publish_history_content")
          .withIndex("by_projectId", (q) => q.eq("projectId", pid))
          .take(1000),
        await ctx.db
          .query("publish_history")
          .withIndex("by_projectId", (q) => q.eq("projectId", pid))
          .take(1000),
        await ctx.db
          .query("document_snapshot_content")
          .withIndex("by_projectId", (q) => q.eq("projectId", pid))
          .take(1000),
        await ctx.db
          .query("document_snapshots")
          .withIndex("by_projectId", (q) => q.eq("projectId", pid))
          .take(1000),
        await ctx.db
          .query("document_draft_content")
          .withIndex("by_projectId", (q) => q.eq("projectId", pid))
          .take(1000),
        await ctx.db
          .query("document_drafts")
          .withIndex("by_projectId", (q) => q.eq("projectId", pid))
          .take(1000),
        await ctx.db
          .query("document_content")
          .withIndex("by_projectId", (q) => q.eq("projectId", pid))
          .take(1000),
        await ctx.db
          .query("documents")
          .withIndex("by_projectId", (q) => q.eq("projectId", pid))
          .take(1000),
      ];
      for (const page of pages) {
        for (const row of page) {
          await ctx.db.delete(row._id);
          deleted++;
        }
      }
      await ctx.db.delete(project._id);
      deleted++;
    }
    await ctx.db.delete(user._id);
    deleted++;

    return { status: "cleaned", deleted };
  },
});

/* ==================================================================== */
/*  Admin UI wrappers (`/admin/seed` → Cost-optimization test bench)     */
/* ==================================================================== */

/** Client-facing result shapes for the test-bench UI. */
export type CostOptSeedResult = { status: string; hint?: string };
export type CostOptTableStat = { table: string; rows: number; bytes: number };
export type CostOptInspectResult = {
  status: string;
  draftListReadSetBytes?: number;
  publishListReadSetBytes?: number;
  snapshotListReadSetBytes?: number;
  tables?: CostOptTableStat[];
  invariants?: Record<string, boolean | number>;
};
export type CostOptCleanupResult = { status: string; deleted?: number };

export const runSeed = action({
  args: {},
  handler: async (ctx): Promise<CostOptSeedResult> => {
    const key = await getRateLimitKey(ctx);
    await rateLimiter.limit(ctx, "migrations:run", { key, throws: true });
    await requireAdmin(ctx);
    const result: CostOptSeedResult = await ctx.runMutation(
      internal._seed.costOptTest.seedLegacy,
      {},
    );
    return result;
  },
});

export const runInspect = action({
  args: {},
  handler: async (ctx): Promise<CostOptInspectResult> => {
    const key = await getRateLimitKey(ctx);
    await rateLimiter.limit(ctx, "migrations:run", { key, throws: true });
    await requireAdmin(ctx);
    const result: CostOptInspectResult = await ctx.runMutation(
      internal._seed.costOptTest.inspect,
      {},
    );
    return result;
  },
});

export const runCleanup = action({
  args: {},
  handler: async (ctx): Promise<CostOptCleanupResult> => {
    const key = await getRateLimitKey(ctx);
    await rateLimiter.limit(ctx, "migrations:run", { key, throws: true });
    await requireAdmin(ctx);
    const result: CostOptCleanupResult = await ctx.runMutation(
      internal._seed.costOptTest.cleanup,
      {},
    );
    return result;
  },
});

/* ==================================================================== */
/*  Workload seeder — NEW-format data into a REAL project                */
/* ==================================================================== */

/**
 * Fills an existing (real) project with post-optimization-format content so
 * the app can be exercised at realistic volume and read/write behaviour
 * observed on the Convex dashboard: documents with `document_content` rows +
 * `contentId` pointers, metadata-only drafts with `document_draft_content`,
 * hashed snapshots with `document_snapshot_content`, and publish history
 * with `publish_history_content`. Slugs carry `seed-wl-` so removal can
 * find every seeded row via the `by_projectId_and_slug` prefix range
 * without touching real articles.
 */
const WL_SLUG_PREFIX = "seed-wl-";
const WL_DOC_COUNT = 20;
const WL_DOCS_PER_CHUNK = 4;
const WL_DRAFTS_PER_DOC = 3;
const WL_SNAPSHOTS_PER_DOC = 5;
const WL_PUBLISHES_PER_DOC = 8;
const WL_STATUSES = ["draft", "review", "ready", "published"] as const;

export const _seedWorkloadChunk = internalMutation({
  args: {
    projectId: v.id("projects"),
    startIndex: v.number(),
    count: v.number(),
  },
  handler: async (ctx, args) => {
    const project = await ctx.db.get(args.projectId);
    if (!project) throw new Error("Project not found");
    const userId = project.userId;
    let created = 0;

    for (let i = args.startIndex; i < args.startIndex + args.count; i++) {
      if (i >= WL_DOC_COUNT) break;
      const n = String(i + 1).padStart(2, "0");
      const slug = `${WL_SLUG_PREFIX}${n}`;

      // Idempotency: skip docs that already exist (indexed slug lookup).
      const already = await ctx.db
        .query("documents")
        .withIndex("by_projectId_and_slug", (q) =>
          q.eq("projectId", args.projectId).eq("slug", slug),
        )
        .first();
      if (already) continue;

      const status = WL_STATUSES[i % WL_STATUSES.length] ?? "draft";
      const content = makeContent(`Seeded article ${n}`, 9);
      // Spread creation over the past weeks so lists/calendar look real.
      const createdAt = Date.now() - i * 36 * 60 * 60 * 1000;

      const docId = await ctx.db.insert("documents", {
        projectId: args.projectId,
        userId,
        title: `Seeded article ${n}`,
        slug,
        status,
        excerpt: buildExcerpt(content),
        wordCount: countWords(content),
        tags: ["seeded"],
        ...(status === "published" ? { publishedAt: createdAt } : {}),
        createdAt,
        updatedAt: createdAt,
      });
      const contentId = await writeContent(ctx, {
        documentId: docId,
        projectId: args.projectId,
        userId,
        content,
      });
      await ctx.db.patch(docId, { contentId });

      for (let d = 1; d <= WL_DRAFTS_PER_DOC; d++) {
        const draftBody = makeContent(`Draft ${String(d)} of ${n}`, 8);
        const draftId = await ctx.db.insert("document_drafts", {
          documentId: docId,
          projectId: args.projectId,
          userId,
          label: `Angle ${String(d)}`,
          wordCount: countWords(draftBody),
          createdAt: createdAt + d,
          updatedAt: createdAt + d,
        });
        const draftContentId = await writeDraftContent(ctx, {
          draftId,
          documentId: docId,
          projectId: args.projectId,
          userId,
          title: `Seeded article ${n} — angle ${String(d)}`,
          content: draftBody,
        });
        await ctx.db.patch(draftId, { contentId: draftContentId });
      }

      for (let s = 1; s <= WL_SNAPSHOTS_PER_DOC; s++) {
        const snapBody = makeContent(`Snapshot ${String(s)} of ${n}`, 9);
        const snapId = await ctx.db.insert("document_snapshots", {
          documentId: docId,
          projectId: args.projectId,
          userId,
          reason: s % 2 ? "interval" : "manual",
          title: `Seeded article ${n}`,
          contentHash: contentHash(snapBody),
          wordCount: countWords(snapBody),
          createdAt: createdAt + s * 600_000,
        });
        await ctx.db.insert("document_snapshot_content", {
          snapshotId: snapId,
          documentId: docId,
          projectId: args.projectId,
          userId,
          content: snapBody,
        });
      }

      for (let p = 1; p <= WL_PUBLISHES_PER_DOC; p++) {
        const pubBody = makeContent(`Publish ${String(p)} of ${n}`, 9);
        const publishId = await ctx.db.insert("publish_history", {
          documentId: docId,
          projectId: args.projectId,
          userId,
          commitSha: `seedsha-${n}-${String(p)}`,
          githubPath: `content/${slug}.md`,
          commitMessage: `docs: update seeded article ${n} (rev ${String(p)})`,
          titleSnapshot: `Seeded article ${n}`,
          isUpdate: p > 1,
          createdAt: createdAt + p * 3_600_000,
        });
        await ctx.db.insert("publish_history_content", {
          publishId,
          documentId: docId,
          projectId: args.projectId,
          userId,
          content: pubBody,
        });
      }

      created++;
    }
    return { created };
  },
});

/**
 * Recomputes the project's denormalized counters after seeding/removal so
 * the UI (documentCount, status breakdown, total words) matches reality.
 * Bounded scan — fine for local test volumes.
 */
export const _recountWorkloadProject = internalMutation({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    const project = await ctx.db.get(args.projectId);
    if (!project) throw new Error("Project not found");

    const docs = await ctx.db
      .query("documents")
      .withIndex("by_projectId", (q) => q.eq("projectId", args.projectId))
      .take(1000);
    const active = docs.filter((d) => d.trashedAt === undefined);

    const counts = {
      draftCount: 0,
      reviewCount: 0,
      readyCount: 0,
      scheduledCount: 0,
      publishedCount: 0,
    };
    let totalWords = 0;
    for (const d of active) {
      totalWords += d.wordCount ?? 0;
      if (d.status === "draft") counts.draftCount++;
      else if (d.status === "review") counts.reviewCount++;
      else if (d.status === "ready") counts.readyCount++;
      else if (d.status === "scheduled") counts.scheduledCount++;
      else if (d.status === "published") counts.publishedCount++;
    }

    await ctx.db.patch(args.projectId, { documentCount: active.length });
    const stats = await ctx.db
      .query("project_stats")
      .withIndex("by_projectId", (q) => q.eq("projectId", args.projectId))
      .unique();
    if (stats) {
      await ctx.db.patch(stats._id, {
        ...counts,
        totalWords,
        updatedAt: Date.now(),
      });
    } else {
      await ctx.db.insert("project_stats", {
        projectId: args.projectId,
        userId: project.userId,
        ...counts,
        totalWords,
        updatedAt: Date.now(),
      });
    }
    return { documentCount: active.length, totalWords };
  },
});

/**
 * Removes seeded workload documents (slug prefix range on
 * `by_projectId_and_slug`) plus every dependent artifact via the shared
 * purge helper. Bounded per call; the action loops until done.
 */
export const _removeWorkloadChunk = internalMutation({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    const docs = await ctx.db
      .query("documents")
      .withIndex("by_projectId_and_slug", (q) =>
        q
          .eq("projectId", args.projectId)
          .gte("slug", WL_SLUG_PREFIX)
          .lt("slug", `${WL_SLUG_PREFIX}￿`),
      )
      .take(2);

    let removed = 0;
    for (const doc of docs) {
      // Seeded docs carry ~16 artifact rows each — one purge call covers it.
      const { done } = await purgeDocumentArtifacts(ctx, doc._id);
      if (!done) return { removed, done: false };
      if (doc.contentId) {
        const contentRow = await ctx.db.get(doc.contentId);
        if (contentRow) await ctx.db.delete(contentRow._id);
      }
      await ctx.db.delete(doc._id);
      removed++;
    }
    return { removed, done: docs.length < 2 };
  },
});

export type WorkloadResult = { status: string; documents: number };

export const seedWorkload = action({
  args: { projectId: v.string() },
  handler: async (ctx, args): Promise<WorkloadResult> => {
    const key = await getRateLimitKey(ctx);
    await rateLimiter.limit(ctx, "migrations:run", { key, throws: true });
    await requireAdmin(ctx);

    const projectId = args.projectId.trim() as Id<"projects">;
    let created = 0;
    for (let start = 0; start < WL_DOC_COUNT; start += WL_DOCS_PER_CHUNK) {
      const res: { created: number } = await ctx.runMutation(
        internal._seed.costOptTest._seedWorkloadChunk,
        { projectId, startIndex: start, count: WL_DOCS_PER_CHUNK },
      );
      created += res.created;
    }
    await ctx.runMutation(internal._seed.costOptTest._recountWorkloadProject, {
      projectId,
    });
    return {
      status: created > 0 ? "seeded" : "already-seeded",
      documents: created,
    };
  },
});

export const removeWorkload = action({
  args: { projectId: v.string() },
  handler: async (ctx, args): Promise<WorkloadResult> => {
    const key = await getRateLimitKey(ctx);
    await rateLimiter.limit(ctx, "migrations:run", { key, throws: true });
    await requireAdmin(ctx);

    const projectId = args.projectId.trim() as Id<"projects">;
    let removed = 0;
    // 20 seeded docs / 2 per chunk = ~10 iterations; cap generously.
    for (let i = 0; i < 40; i++) {
      const res: { removed: number; done: boolean } = await ctx.runMutation(
        internal._seed.costOptTest._removeWorkloadChunk,
        { projectId },
      );
      removed += res.removed;
      if (res.done) break;
    }
    await ctx.runMutation(internal._seed.costOptTest._recountWorkloadProject, {
      projectId,
    });
    return { status: "removed", documents: removed };
  },
});
