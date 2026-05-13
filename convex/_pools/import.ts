/**
 * Workpool for chunked GitHub-to-Convex blog imports.
 *
 * Bulk imports can span hundreds of files. Running them through a single
 * server-side loop would either flood the per-document rate limit or block
 * the action for minutes. Instead we enqueue one job per file in this pool
 * and let it process up to `maxParallelism` in flight at a time — the user
 * gets a reactive progress view backed by `import_batches`, and the rate
 * limit becomes a safety net rather than the bottleneck.
 *
 * Retry policy: GitHub Contents API hiccups are transient, so we retry
 * each job a few times with backoff. Hard failures (missing file, 404)
 * surface in the batch's `errors` array via the onComplete callback.
 */
import { Workpool } from "@convex-dev/workpool";
import { components } from "../_generated/api";

export const importPool = new Workpool(components.githubImportPool, {
  // Concurrency cap shared across all users and projects. Five is a
  // conservative starting point — large enough that even a 200-file import
  // finishes in ~60s, small enough that ten simultaneous users don't
  // saturate the GitHub Contents API budget. Tune via Convex logs.
  maxParallelism: 5,
  retryActionsByDefault: true,
  defaultRetryBehavior: {
    maxAttempts: 3,
    initialBackoffMs: 1500,
    base: 2,
  },
});
