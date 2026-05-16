/**
 * Centralized rate limit definitions for the entire application.
 *
 * All public mutations, queries, and actions should call
 * `await rateLimiter.limit(ctx, "name", { key, throws: true })`
 * to enforce these limits. Internal functions are exempt (they're
 * already behind auth and called by trusted server code).
 *
 * Rate limits use two strategies:
 * - "fixed window": hard cap per period (good for create/delete ops)
 * - "token bucket": allows short bursts while maintaining a long-term rate
 *                   (good for high-frequency ops like auto-save)
 */
import { HOUR, MINUTE, RateLimiter } from "@convex-dev/rate-limiter";
import { components } from "../_generated/api";
import type { ActionCtx, MutationCtx } from "../_generated/server";

/**
 * Extracts a stable rate-limit key from the authenticated user's identity.
 * Falls back to "anonymous" so unauthenticated requests still get rate-limited
 * (globally, under one shared bucket).
 *
 * Note: Rate limiting is only applied to mutations and actions (not queries)
 * because the rate limiter needs write access to track token consumption.
 * Queries are read-only and already protected by authentication.
 */
export async function getRateLimitKey(
  ctx: MutationCtx | ActionCtx,
): Promise<string> {
  const identity = await ctx.auth.getUserIdentity();
  return identity?.tokenIdentifier ?? "anonymous";
}

export const rateLimiter = new RateLimiter(components.rateLimiter, {
  /* ------------------------------------------------------------------ */
  /*  Users                                                              */
  /* ------------------------------------------------------------------ */

  /** User sync on sign-in — very infrequent, but protect against loops. */
  "users:getOrCreate": {
    kind: "token bucket",
    rate: 10,
    period: MINUTE,
    capacity: 5,
  },
  /** GitHub token update — rare, deliberate action. */
  "users:updateGithubToken": {
    kind: "fixed window",
    rate: 10,
    period: MINUTE,
  },
  /** GitHub username update — same as token. */
  "users:updateGithubUsername": {
    kind: "fixed window",
    rate: 10,
    period: MINUTE,
  },
  /** Account-wide default for image compression — rare, deliberate. */
  "users:updateDefaultCompressionSettings": {
    kind: "fixed window",
    rate: 10,
    period: MINUTE,
  },
  /**
   * Self-destruct (account reset). Intentionally tight — this is a
   * destructive action; nobody should be running it on a loop.
   */
  "users:selfDestruct": {
    kind: "fixed window",
    rate: 3,
    period: HOUR,
  },

  /* ------------------------------------------------------------------ */
  /*  Projects                                                           */
  /* ------------------------------------------------------------------ */

  "projects:create": {
    kind: "fixed window",
    rate: 10,
    period: HOUR,
  },
  "projects:update": {
    kind: "token bucket",
    rate: 20,
    period: MINUTE,
    capacity: 5,
  },
  "projects:remove": {
    kind: "fixed window",
    rate: 5,
    period: HOUR,
  },

  /* ------------------------------------------------------------------ */
  /*  Documents — mutations                                              */
  /* ------------------------------------------------------------------ */

  "documents:create": {
    kind: "fixed window",
    rate: 20,
    period: MINUTE,
  },
  /** Auto-save fires frequently — generous bucket with burst capacity. */
  "documents:update": {
    kind: "token bucket",
    rate: 120,
    period: MINUTE,
    capacity: 30,
  },
  "documents:duplicate": {
    kind: "fixed window",
    rate: 10,
    period: MINUTE,
  },
  "documents:updateStatus": {
    kind: "token bucket",
    rate: 30,
    period: MINUTE,
    capacity: 5,
  },
  "documents:remove": {
    kind: "fixed window",
    rate: 20,
    period: MINUTE,
  },
  /**
   * Per-document import mutation. The real concurrency gate is the
   * `githubImportPool` workpool (`convex/_pools/import.ts`) which caps how
   * many imports run at once. This bucket is intentionally generous so
   * a user with 200+ posts isn't blocked by the rate limiter — the
   * workpool's `maxParallelism` is what actually shapes throughput. A
   * 60-token burst lets the first batch hit the database in parallel,
   * then the bucket refills at ~10/second sustained.
   */
  "documents:importFromGithub": {
    kind: "token bucket",
    rate: 600,
    period: MINUTE,
    capacity: 60,
  },
  /**
   * Per-batch enqueue. Each batch can contain up to 200 file paths so
   * this is a "how many bulk imports per minute" cap, not a per-file
   * cap. Tight on purpose — accidentally clicking "Import" repeatedly
   * shouldn't spawn dozens of overlapping batches.
   */
  "documents:startBulkImport": {
    kind: "fixed window",
    rate: 10,
    period: MINUTE,
  },
  /**
   * Symmetric cap for bulk deletes. Tighter than bulk imports because
   * deletes are destructive — accidental fat-finger of "Delete All"
   * should not be amplifiable.
   */
  "documents:startBulkDelete": {
    kind: "fixed window",
    rate: 5,
    period: MINUTE,
  },
  "documents:toggleBookmark": {
    kind: "token bucket",
    rate: 30,
    period: MINUTE,
    capacity: 5,
  },
  "documents:moveCard": {
    kind: "token bucket",
    rate: 30,
    period: MINUTE,
    capacity: 10,
  },
  "documents:updateTags": {
    kind: "token bucket",
    rate: 30,
    period: MINUTE,
    capacity: 5,
  },
  "documents:rollbackToVersion": {
    kind: "fixed window",
    rate: 10,
    period: MINUTE,
  },
  /**
   * Sync-conflict resolution. The user can plough through a stack of
   * conflicts (use github / keep convex / merge), but each resolution
   * is a deliberate click, not a loop — generous bucket keeps the UI
   * responsive while protecting against runaway scripts.
   */
  "conflicts:resolve": {
    kind: "token bucket",
    rate: 60,
    period: MINUTE,
    capacity: 10,
  },
  "documents:restoreFromTrash": {
    kind: "token bucket",
    rate: 60,
    period: MINUTE,
    capacity: 10,
  },
  "documents:permanentDelete": {
    kind: "fixed window",
    rate: 30,
    period: MINUTE,
  },
  "documents:emptyTrash": {
    kind: "fixed window",
    rate: 5,
    period: HOUR,
  },

  /* ------------------------------------------------------------------ */
  /*  Board columns                                                      */
  /* ------------------------------------------------------------------ */

  "boardColumns:updateColumns": {
    kind: "fixed window",
    rate: 20,
    period: MINUTE,
  },
  "boardColumns:addColumn": {
    kind: "fixed window",
    rate: 20,
    period: MINUTE,
  },
  "boardColumns:removeColumn": {
    kind: "fixed window",
    rate: 20,
    period: MINUTE,
  },
  "boardColumns:reorderColumns": {
    kind: "fixed window",
    rate: 20,
    period: MINUTE,
  },

  /* ------------------------------------------------------------------ */
  /*  Media                                                              */
  /* ------------------------------------------------------------------ */

  /** Direct provider uploads — generous burst for paste-heavy writing. */
  "media:upload": {
    kind: "token bucket",
    rate: 60,
    period: MINUTE,
    capacity: 10,
  },
  /** Library list calls — reactive UI may refresh frequently. */
  "media:list": {
    kind: "token bucket",
    rate: 60,
    period: MINUTE,
    capacity: 20,
  },
  /** Manual deletes from the media library. */
  "media:delete": {
    kind: "token bucket",
    rate: 30,
    period: MINUTE,
    capacity: 5,
  },
  /** Per-user concurrency token — only 3 in flight at a time. */
  "media:uploadConcurrency": {
    kind: "token bucket",
    rate: 180,
    period: MINUTE,
    capacity: 3,
  },
  /** Global circuit breaker — keyed on a constant string. */
  "media:globalUpload": {
    kind: "fixed window",
    rate: 5000,
    period: MINUTE,
  },
  "mediaCredentials:set": {
    kind: "token bucket",
    rate: 5,
    period: MINUTE,
    capacity: 2,
  },
  "mediaCredentials:rotate": {
    kind: "fixed window",
    rate: 10,
    period: HOUR,
  },
  "mediaCredentials:test": {
    kind: "token bucket",
    rate: 20,
    period: MINUTE,
    capacity: 5,
  },
  "mediaCredentials:delete": {
    kind: "fixed window",
    rate: 5,
    period: HOUR,
  },
  /** WorkOS Vault reads — protects our WorkOS bill. */
  "vault:read": {
    kind: "token bucket",
    rate: 240,
    period: MINUTE,
    capacity: 30,
  },
  "vault:write": {
    kind: "token bucket",
    rate: 10,
    period: MINUTE,
    capacity: 3,
  },

  /* ------------------------------------------------------------------ */
  /*  Legacy media (kept for one release to support drain migration)     */
  /* ------------------------------------------------------------------ */

  "media:generateUploadUrl": {
    kind: "fixed window",
    rate: 30,
    period: MINUTE,
  },
  "media:saveMedia": {
    kind: "fixed window",
    rate: 30,
    period: MINUTE,
  },
  "media:deleteStaged": {
    kind: "fixed window",
    rate: 30,
    period: MINUTE,
  },

  /* ------------------------------------------------------------------ */
  /*  Scheduling                                                         */
  /* ------------------------------------------------------------------ */

  "scheduling:schedule": {
    kind: "fixed window",
    rate: 10,
    period: MINUTE,
  },
  "scheduling:cancel": {
    kind: "fixed window",
    rate: 10,
    period: MINUTE,
  },

  /* ------------------------------------------------------------------ */
  /*  AI enhancement                                                     */
  /* ------------------------------------------------------------------ */

  /** AI calls are expensive — tight limits. */
  "ai:createEnhanceStream": {
    kind: "fixed window",
    rate: 10,
    period: MINUTE,
  },
  "ai:createInlineEnhanceStream": {
    kind: "fixed window",
    rate: 20,
    period: MINUTE,
  },
  "ai:createFrontmatterStream": {
    kind: "fixed window",
    rate: 10,
    period: MINUTE,
  },
  "aiCredentials:set": {
    kind: "token bucket",
    rate: 5,
    period: MINUTE,
    capacity: 2,
  },
  "aiCredentials:rotate": {
    kind: "fixed window",
    rate: 10,
    period: HOUR,
  },
  "aiCredentials:test": {
    kind: "token bucket",
    rate: 20,
    period: MINUTE,
    capacity: 5,
  },
  "aiCredentials:delete": {
    kind: "fixed window",
    rate: 5,
    period: HOUR,
  },

  /* ------------------------------------------------------------------ */
  /*  GitHub actions                                                     */
  /* ------------------------------------------------------------------ */

  "github:publish": {
    kind: "fixed window",
    rate: 10,
    period: MINUTE,
  },
  "github:bulkPublish": {
    kind: "fixed window",
    rate: 5,
    period: MINUTE,
  },
  "github:uploadMedia": {
    kind: "fixed window",
    rate: 20,
    period: MINUTE,
  },
  /**
   * Imports are called in a loop when the user bulk-pulls existing posts
   * from a repo. A token bucket with a generous burst lets a typical
   * 30-file import go through instantly, then refills steadily for larger
   * archives. The batch importer also honours `retryAfter` so really large
   * imports (100+) just slow down rather than fail.
   */
  "github:importFile": {
    kind: "token bucket",
    rate: 120,
    period: MINUTE,
    capacity: 60,
  },
  "github:verifyRepoAccess": {
    kind: "fixed window",
    rate: 10,
    period: MINUTE,
  },
  "github:deleteFile": {
    kind: "fixed window",
    rate: 20,
    period: MINUTE,
  },

  /* ------------------------------------------------------------------ */
  /*  Clerk Backend SDK                                                  */
  /* ------------------------------------------------------------------ */

  /**
   * Clerk OAuth token fetches. Every Convex action that needs a GitHub
   * token calls Clerk fresh, so we protect against a retry loop quietly
   * DOSing our Clerk dashboard. Generous enough to handle a bulk-publish
   * fanning out to many files.
   */
  "clerk:getOauthToken": {
    kind: "token bucket",
    rate: 120,
    period: MINUTE,
    capacity: 30,
  },

  /* ------------------------------------------------------------------ */
  /*  Changelog (admin-only)                                             */
  /* ------------------------------------------------------------------ */

  "changelog:create": {
    kind: "fixed window",
    rate: 30,
    period: HOUR,
  },
  "changelog:update": {
    kind: "token bucket",
    rate: 60,
    period: MINUTE,
    capacity: 10,
  },
  "changelog:remove": {
    kind: "fixed window",
    rate: 10,
    period: HOUR,
  },

  /* ------------------------------------------------------------------ */
  /*  Feature requests                                                   */
  /* ------------------------------------------------------------------ */

  /** Public submission — generous but anti-spam. */
  "featureRequests:create": {
    kind: "fixed window",
    rate: 10,
    period: HOUR,
  },
  /** Upvotes need to feel instant — token bucket with burst capacity. */
  "featureRequests:toggleUpvote": {
    kind: "token bucket",
    rate: 60,
    period: MINUTE,
    capacity: 15,
  },
  /** Admin moderation — same generous shape as changelog edits. */
  "featureRequests:updateStatus": {
    kind: "token bucket",
    rate: 60,
    period: MINUTE,
    capacity: 10,
  },
  "featureRequests:remove": {
    kind: "fixed window",
    rate: 30,
    period: HOUR,
  },

  /* ------------------------------------------------------------------ */
  /*  One-shot seed scripts                                              */
  /* ------------------------------------------------------------------ */

  /** Tight cap — seeding is a one-off, accidental loops are the only risk. */
  "seed:run": {
    kind: "fixed window",
    rate: 5,
    period: MINUTE,
  },
});
