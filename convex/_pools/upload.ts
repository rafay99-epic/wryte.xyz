/**
 * Workpool instances for media operations.
 *
 * - `uploadPool` caps how many provider uploads happen at once across the
 *   whole deployment. Per-user concurrency is enforced separately by the
 *   `uploads:concurrency` rate limit in `convex/_lib/rateLimits.ts`.
 * - `maintenancePool` runs background jobs (TTL cleanups, the one-shot
 *   migration, nightly credential health checks).
 *
 * Pool components are registered in `convex/convex.config.ts`.
 */
import { Workpool } from "@convex-dev/workpool";
import { components } from "../_generated/api";

export const uploadPool = new Workpool(components.mediaUploadPool, {
  maxParallelism: 10,
  retryActionsByDefault: false,
  defaultRetryBehavior: {
    maxAttempts: 3,
    initialBackoffMs: 1000,
    base: 2,
  },
});

export const maintenancePool = new Workpool(components.mediaMaintenancePool, {
  maxParallelism: 3,
  retryActionsByDefault: true,
  defaultRetryBehavior: {
    maxAttempts: 3,
    initialBackoffMs: 2000,
    base: 2,
  },
});
