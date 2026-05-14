---
title: "Importing 200 Blog Posts in 60 Seconds: Bulk Operations on Convex with Optimistic UI"
slug: bulk-operations-convex-optimistic-ui
description: "Building safe, fast, observable bulk import and bulk delete in a Convex CMS — from naive Promise.all loops that hit rate limits, through the OCC contention trap, to a Workpool-driven pipeline with per-job outcome rows and a reactive progress dialog that needs zero polling."
date: 2026-05-14
author: "Abdul Rafay"
canonicalUrl: "https://wryte.xyz/blog/bulk-operations-convex-optimistic-ui"
ogImage: "/images/blog/bulk-operations-cover.png"
twitterCard: "summary_large_image"

# SEO
keywords:
  - convex bulk operations
  - convex workpool
  - bulk import optimistic UI
  - convex OCC error
  - optimistic concurrency control
  - reactive progress bar
  - convex react query subscription
  - convex rate limiter
  - bulk delete pattern
  - SaaS CMS architecture
seo:
  title: "Bulk Import & Delete on Convex with Optimistic UI — Wryte.xyz"
  description: "How we built bulk import (200 files in ~60s) and bulk delete on top of Convex's Workpool, escaped OCC contention with per-job outcome rows, and got a real-time progress dialog with no polling."
  openGraph:
    type: article
    title: "Importing 200 Blog Posts in 60 Seconds"
    description: "From rate-limit hell to a clean, observable bulk pipeline on Convex."
    image: "/images/blog/bulk-operations-cover.png"
  twitter:
    card: summary_large_image
    title: "Bulk Operations on Convex with Optimistic UI"
    description: "Workpool + per-job outcome rows + reactive subscriptions = no polling, no OCC errors, no stuck progress bars."

# Image generation
imagePrompt: >
  An isometric digital illustration of a large funnel converting a flowing
  stream of paper documents into compact glowing data packets dropping into a
  database. Cool blue-to-emerald gradient palette. A small progress ring
  hovers above the funnel with a "187 / 200" label. Subtle grid background.
  Minimal, modern, Stripe-blog-meets-Vercel-aesthetic. No text other than the
  progress counter. 16:9 ratio.

# Optional regeneration prompt
regenerationPrompt: >
  Rewrite this post in a slightly more conversational developer-blog tone
  while preserving the technical accuracy of every code block. Keep the same
  three-act structure: naive approach → OCC pain → final pattern. The
  audience is mid-senior full-stack engineers familiar with React and
  serverless backends but not necessarily with Convex. Target ~2400 words.
  Preserve all section headings and references.

tags:
  - convex
  - react
  - typescript
  - patterns
  - performance
---

# Importing 200 Blog Posts in 60 Seconds

There's a moment in every CMS where a user says *"actually, can I import all my old posts from GitHub?"* For one user that's 8 markdown files. For the next it's 200. For the one after that, it's a portfolio site they've been writing on for nine years and they want all of it.

This is the story of how I went from a polite "one file at a time" import to a real bulk pipeline on [Convex](https://convex.dev) — one that imports 200 files in about a minute, never deadlocks on optimistic concurrency, and shows the user exactly what's happening without a single `setInterval`.

It took three rewrites to get there. Each one taught me something the docs didn't quite spell out.

## The challenge

**Wryte.xyz** is a Git-backed markdown CMS. You connect a GitHub repo, point at a content folder, and you can write in our editor while the actual files live in your repo. Every publish becomes a commit.

The first version of "import from GitHub" was one file at a time. You'd click a file in the remote browser, the action would fetch it via Octokit, parse the frontmatter, dedupe by `githubPath`, insert a row. Round trip: 3-5 seconds.

Fine for a few files. Catastrophic for an archive.

> Real test case: a user had 187 posts in `content/blog/`. Their session would either die from the browser killing a long-running action, or they'd accept defeat halfway and the database would end up with 80 imported files and 107 ghosts.

We needed bulk. The question was what shape.

## Attempt 1: `Promise.all` (the obvious wrong answer)

The first try was the dumbest possible thing:

```ts
// DON'T DO THIS
const results = await Promise.all(
  filePaths.map((path) => importFile({ projectId, filePath: path }))
);
```

This blew up immediately. Two reasons:

1. **Rate limits**. Our `documents:importFromGithub` mutation has a per-user bucket. Fan out 200 calls in one tick and you eat the bucket in milliseconds — half the calls bounce with `RateLimited` errors.
2. **GitHub Contents API**. We hit their rate limits too, but on a different bucket.

Even if both rate limits were infinite, the action's response timeout was a hard ceiling. Long imports just died.

I added a sequential `for` loop with retry-on-rate-limit. It worked. It also took eight minutes for 200 files.

That's not "bulk import". That's "go make tea import".

## Attempt 2: Convex Workpool

[Convex Workpool](https://www.convex.dev/components/workpool) is a component that gives you a queue with a configurable concurrency cap. You enqueue jobs (each is an action call), the workpool runs N in parallel, retries failures with exponential backoff, and calls an `onComplete` callback when each job finishes.

This is exactly the shape I wanted: a concurrency knob I could tune, a retry policy I didn't have to hand-write, and a callback hook to update progress.

```ts
// convex/_pools/import.ts
import { Workpool } from "@convex-dev/workpool";
import { components } from "../_generated/api";

export const importPool = new Workpool(components.githubImportPool, {
  maxParallelism: 5,
  retryActionsByDefault: true,
  defaultRetryBehavior: {
    maxAttempts: 3,
    initialBackoffMs: 1500,
    base: 2,
  },
});
```

Register the component in `convex.config.ts`:

```ts
import workpool from "@convex-dev/workpool/convex.config.js";
import { defineApp } from "convex/server";

const app = defineApp();
app.use(workpool, { name: "githubImportPool" });
export default app;
```

Five concurrent imports felt right: large enough that 200 files finish in ~60 seconds, small enough that ten users hitting bulk-import at once won't saturate the GitHub Contents API.

The bulk action looks like this:

```ts
// convex/integrations/github.ts
export const startBulkImport = action({
  args: {
    projectId: v.id("projects"),
    filePaths: v.array(v.string()),
  },
  handler: async (ctx, args): Promise<{ batchId: Id<"import_batches"> }> => {
    const key = await getRateLimitKey(ctx);
    await rateLimiter.limit(ctx, "documents:startBulkImport", {
      key,
      throws: true,
    });

    // Dedup: a double-click should not enqueue the same path twice.
    const uniquePaths = [...new Set(args.filePaths)];

    // Verify ownership before enqueuing. Each job runs without an auth
    // session, so the boundary check has to happen here.
    const user = await ctx.runQuery(internal.account.users.internalGetByToken, {
      tokenIdentifier: /* ... */,
    });
    const project = await ctx.runQuery(internal.cms.projects.internalGet, {
      projectId: args.projectId,
    });
    if (!project || project.userId !== user._id) {
      throw new Error("Unauthorized");
    }

    // Create the tracking row.
    const batchId = await ctx.runMutation(internal.cms.documents._createImportBatch, {
      projectId: args.projectId,
      userId: user._id,
      total: uniquePaths.length,
    });

    // Enqueue one job per file.
    for (const filePath of uniquePaths) {
      await importPool.enqueueAction(
        ctx,
        internal.integrations.github._importOneFromGithubJob,
        { projectId: args.projectId, filePath, batchId },
        { onComplete: internal.cms.documents._onImportFileComplete },
      );
    }

    return { batchId };
  },
});
```

The action returns *immediately* after enqueueing. The user gets a `batchId` and the import runs asynchronously in the pool. The next problem became: how do you show the user progress without polling?

## The reactive progress dialog (zero polling)

Convex queries are reactive subscriptions. If you subscribe to a query and any row the query touched changes, the query re-runs and React re-renders. Perfect for a live progress bar.

The hook on the client:

```tsx
// in the page component
const [batchId, setBatchId] = useState<Id<"import_batches"> | null>(null);

const batch = useQuery(
  api.cms.documents.getImportBatch,
  batchId ? { batchId } : "skip",
);

const handleStartBulkImport = async () => {
  const result = await startBulkImport({ projectId, filePaths });
  setBatchId(result.batchId);
};

return (
  <BulkImportDialog
    open={batchId !== null}
    batch={batch} // { total, succeeded, failed, errors }
    phase={batch?.succeeded + batch?.failed === batch?.total ? "complete" : "progress"}
    onDone={() => setBatchId(null)}
  />
);
```

The `BulkImportDialog` renders a progress bar and per-item success/failure counts that update live as jobs complete in the workpool. No `setInterval`, no manual refetch, no "Refresh" button.

Here's where it got interesting.

## Attempt 3: The OCC trap

My first version of `_onImportFileComplete` was the natural thing:

```ts
// DON'T DO THIS
export const _onImportFileComplete = internalMutation({
  args: { batchId: v.id("import_batches"), success: v.boolean(), error: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const batch = await ctx.db.get(args.batchId);
    if (!batch) return;
    await ctx.db.patch(args.batchId, {
      succeeded: batch.succeeded + (args.success ? 1 : 0),
      failed: batch.failed + (args.success ? 0 : 1),
    });
  },
});
```

Five concurrent jobs all finishing within a millisecond of each other. Each one reads the batch row, computes a new count, and writes it back. Convex's optimistic concurrency control says: *no, you can't all win the race for the same row*.

The errors looked like this:

```
ConvexError: Documents read from or written to the table "import_batches" changed
while this mutation was being run and on which it depended. Consider using ...
```

This is OCC working as designed. Convex serializes writes to a single row to keep your data consistent. If five mutations all try to patch the same row at the same time, four of them lose and have to retry.

That's normally fine — Convex auto-retries OCC failures. But under heavy contention you get retry storms, latency spikes, and (if you're unlucky) jobs giving up entirely.

**The fix the Convex docs hint at** is to stop writing to a hot row. Instead, each job writes its **own** row, and the aggregate is computed at read time.

## The per-job outcome row pattern

I added a sibling table:

```ts
// convex/schema.ts (excerpt)
import_job_outcomes: defineTable({
  batchId: v.id("import_batches"),
  filePath: v.string(),
  status: v.union(v.literal("success"), v.literal("failure")),
  errorMessage: v.optional(v.string()),
  createdAt: v.number(),
}).index("by_batchId", ["batchId"]),
```

Now `_onImportFileComplete` just inserts into this table:

```ts
export const _onImportFileComplete = internalMutation({
  args: {
    batchId: v.id("import_batches"),
    filePath: v.string(),
    success: v.boolean(),
    errorMessage: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("import_job_outcomes", {
      batchId: args.batchId,
      filePath: args.filePath,
      status: args.success ? "success" : "failure",
      ...(args.errorMessage ? { errorMessage: args.errorMessage } : {}),
      createdAt: Date.now(),
    });
  },
});
```

Inserts to *different rows* don't contend. Every job writes its own outcome row, no contention, no retries.

The `getImportBatch` query does the aggregation at read time:

```ts
export const getImportBatch = query({
  args: { batchId: v.id("import_batches") },
  handler: async (ctx, args) => {
    const user = await getAuthedUserOrNull(ctx);
    if (!user) return null;

    const batch = await ctx.db.get(args.batchId);
    if (!batch || batch.userId !== user._id) return null;

    const outcomes = await ctx.db
      .query("import_job_outcomes")
      .withIndex("by_batchId", (q) => q.eq("batchId", args.batchId))
      .collect();

    let succeeded = 0;
    let failed = 0;
    const errors: Array<{ filePath: string; message: string }> = [];
    for (const o of outcomes) {
      if (o.status === "success") {
        succeeded += 1;
      } else {
        failed += 1;
        if (errors.length < 20) {
          errors.push({
            filePath: o.filePath,
            message: o.errorMessage ?? "Unknown error",
          });
        }
      }
    }

    return { ...batch, succeeded, failed, errors };
  },
});
```

The reactive query subscribes to *both* `import_batches` (for the initial row) and `import_job_outcomes` (via the indexed query). Each insert into outcomes invalidates the query and re-renders the dialog. The UI updates job-by-job as the workpool churns through them.

For our batch sizes (max 200) this is fine. If batches grew into the tens of thousands I'd switch to the [`@convex-dev/aggregate`](https://www.convex.dev/components/aggregate) component which maintains running counters lock-free. But for our usage, `collect()`-ing 200 small rows on every read is unmeasurable noise.

## Bulk delete: same pattern, different boundary

Once the import pipeline worked, delete fell out of the same template:

- Same workpool concurrency cap
- Same per-job outcome row table (`delete_job_outcomes`)
- Same reactive query (`getDeleteBatch`)
- Same dialog component, slightly different copy

But delete had one extra concern: **cross-project security**. The job runs without a user session because the workpool can't carry one. If I accepted any `documentId` and trusted that the caller-action verified ownership, a future bug or a forged caller could delete docs from a project you don't own.

So the `_removeInternal` mutation takes both `documentId` *and* `projectId`, and silently no-ops if they don't match:

```ts
export const _removeInternal = internalMutation({
  args: {
    documentId: v.id("documents"),
    projectId: v.id("projects"),
  },
  handler: async (ctx, args) => {
    const doc = await ctx.db.get(args.documentId);
    if (!doc) return;
    // Defense in depth: even though startBulkDelete verified ownership of
    // projectId before enqueuing, a buggy/forged caller could still hand
    // us a documentId belonging to another project. Filter at the boundary.
    if (doc.projectId !== args.projectId) return;
    await cascadeDeleteScheduledPublishesForDoc(ctx, args.documentId);
    await ctx.db.delete(args.documentId);
  },
});
```

`startBulkDelete` also does a **pre-flight** filter using a new internal query `_listByIdsForProject` that returns only the IDs that legitimately belong to the project. Anything not on that list is silently dropped before enqueuing. Two layers, both cheap.

## Tying it together

Three pieces, working together:

1. **Workpool** caps concurrency (one queue per operation, five jobs in flight at a time).
2. **Per-job outcome rows** dodge OCC contention by writing to different rows.
3. **Reactive queries** turn the database into the source of truth for UI state — the dialog updates as jobs complete, with zero client-side polling.

The final flow:

```
[User clicks "Import All"]
        │
        ▼
[startBulkImport action]
   - rate limit check
   - dedup paths
   - verify ownership
   - createImportBatch (insert row)
   - for each path: importPool.enqueueAction(...)
        │
        ▼ (action returns immediately with batchId)
        │
[Client subscribes to getImportBatch(batchId)]
        │
        ▼  (workpool runs N jobs in parallel)
        │
[For each job:]
   _importOneFromGithubJob (internalAction)
     - fetch from GitHub
     - parse frontmatter
     - dedup by (projectId, githubPath) — indexed
     - insert document
   _onImportFileComplete (onComplete callback)
     - insert into import_job_outcomes
        │
        ▼  (each insert triggers reactive re-render)
        │
[Dialog updates: 187 / 200, 199 / 200, 200 / 200]
        │
        ▼
[Phase flips to "complete", user clicks Done]
```

## What I'd do differently

A few rough edges I'm still living with:

- **No partial-failure resume.** If the workpool dies mid-batch (which it doesn't, but hypothetically), you'd need to re-run the whole batch. For our scale this is fine. At enterprise scale I'd add idempotency tokens and resumable batch state.
- **Hardcoded 200-file cap.** I rate-limit batch *creation* but don't cap files-per-batch on the server. A motivated user could enqueue 5,000 files and starve everyone else's workpool. I'd add a server-side cap.
- **`collect()` on outcomes scales linearly.** Fine at 200, fine at 1,000. Replace with `@convex-dev/aggregate` if you expect 10K+.

But the core architecture survives those changes intact. **Workpool + per-job outcome rows + reactive queries** is a tiny, durable pattern. I've reached for it three more times since.

## References

- [Convex Workpool component](https://www.convex.dev/components/workpool)
- [Convex Rate Limiter component](https://www.convex.dev/components/rate-limiter)
- [Convex queries are reactive subscriptions](https://docs.convex.dev/functions/query-functions#reactive-queries)
- [Optimistic Concurrency Control in Convex](https://docs.convex.dev/database/advanced/occ)
- [Convex Aggregate component (for very large counters)](https://www.convex.dev/components/aggregate)
- [Octokit Contents API](https://docs.github.com/en/rest/repos/contents)
