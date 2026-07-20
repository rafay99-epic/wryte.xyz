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
  "profiles:sync": {
    kind: "token bucket",
    rate: 10,
    period: MINUTE,
    capacity: 5,
  },
  "profiles:update": {
    kind: "token bucket",
    rate: 20,
    period: MINUTE,
    capacity: 8,
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
  "documentDrafts:create": {
    kind: "token bucket",
    rate: 30,
    period: MINUTE,
    capacity: 10,
  },
  "documentDrafts:update": {
    kind: "token bucket",
    rate: 30,
    period: MINUTE,
    capacity: 10,
  },
  "documentDrafts:remove": {
    kind: "fixed window",
    rate: 20,
    period: MINUTE,
  },
  "documentDrafts:restore": {
    kind: "fixed window",
    rate: 10,
    period: MINUTE,
  },
  "documentDrafts:updateContent": {
    kind: "token bucket",
    rate: 120,
    period: MINUTE,
    capacity: 30,
  },
  /**
   * Hot draft autosave (3s debounce) — writes ONLY the draft's content
   * side-table row. Same shape as `documentDrafts:updateContent` (the
   * coarser flush path): generous bucket with burst capacity so a fast
   * typist is never blocked.
   */
  "documentDrafts:autosaveContent": {
    kind: "token bucket",
    rate: 120,
    period: MINUTE,
    capacity: 30,
  },
  "documentDrafts:promote": {
    kind: "fixed window",
    rate: 10,
    period: MINUTE,
  },
  /**
   * Version snapshots — created on manual save and on a 10-minute editing
   * interval, deduped server-side. The bucket allows save-spamming without
   * errors while keeping the write volume bounded.
   */
  "snapshots:create": {
    kind: "token bucket",
    rate: 20,
    period: MINUTE,
    capacity: 6,
  },
  "snapshots:restore": {
    kind: "fixed window",
    rate: 10,
    period: MINUTE,
  },
  /** Share links — deliberate one-off actions. */
  "shareLinks:create": {
    kind: "fixed window",
    rate: 20,
    period: MINUTE,
  },
  "shareLinks:revoke": {
    kind: "fixed window",
    rate: 20,
    period: MINUTE,
  },
  /** Idea inbox — quick captures, deliberate but possibly rapid-fire. */
  "ideas:create": {
    kind: "token bucket",
    rate: 30,
    period: MINUTE,
    capacity: 10,
  },
  "ideas:remove": {
    kind: "fixed window",
    rate: 30,
    period: MINUTE,
  },
  "documentResearch:create": {
    kind: "token bucket",
    rate: 60,
    period: MINUTE,
    capacity: 15,
  },
  "documentResearch:update": {
    kind: "token bucket",
    rate: 120,
    period: MINUTE,
    capacity: 30,
  },
  "documentResearch:remove": {
    kind: "fixed window",
    rate: 30,
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
  /*  AI prompt templates                                                */
  /* ------------------------------------------------------------------ */

  "promptTemplates:updateTemplates": {
    kind: "fixed window",
    rate: 20,
    period: MINUTE,
  },
  "promptTemplates:addTemplate": {
    kind: "fixed window",
    rate: 20,
    period: MINUTE,
  },
  "promptTemplates:removeTemplate": {
    kind: "fixed window",
    rate: 20,
    period: MINUTE,
  },

  /* ------------------------------------------------------------------ */
  /*  Editor snippets (reusable text blocks)                             */
  /* ------------------------------------------------------------------ */

  "snippets:create": {
    kind: "fixed window",
    rate: 30,
    period: MINUTE,
  },
  /** Edits debounce-save from the manager — slightly more generous. */
  "snippets:update": {
    kind: "fixed window",
    rate: 60,
    period: MINUTE,
  },
  "snippets:remove": {
    kind: "fixed window",
    rate: 30,
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
  /*  Project tools                                                      */
  /* ------------------------------------------------------------------ */

  /**
   * On-demand link checker — fans out HTTP requests, so deliberately
   * tight. Strictly user-initiated (no cron).
   */
  "tools:linkCheck": {
    kind: "fixed window",
    rate: 6,
    period: HOUR,
  },
  /**
   * Post-embed oEmbed resolution. One fetch per inserted embed, deliberate
   * but a paste-heavy session can fire several — token bucket with a small
   * burst keeps the UI snappy without allowing runaway scraping.
   */
  "tools:oembed": {
    kind: "token bucket",
    rate: 20,
    period: MINUTE,
    capacity: 5,
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

  /**
   * Deployment-wide AI backstop (load shedding). Applied with NO key, so all
   * four stream mutations share ONE global bucket across every user. The
   * per-user limits below are the primary control; this is a safety valve that
   * only trips on a thundering-herd spike, protecting Convex action scheduling
   * and our function-call budget. Generous on purpose — raise it if real peak
   * traffic legitimately exceeds it (it caps aggregate AI throughput, so don't
   * set it low). Token bucket so brief bursts pass.
   */
  "ai:global": {
    kind: "token bucket",
    rate: 3000,
    period: MINUTE,
    capacity: 600,
  },
  /**
   * Per-provider deployment-wide cap. Applied with `key: provider`, so each
   * provider (anthropic / openai / openrouter / google / groq / any future one)
   * gets its OWN shared bucket across all users — one provider's spike can't
   * monopolise AI throughput or starve the others. One config entry covers
   * every provider via the dynamic key, so adding a provider needs no
   * rate-limit change. Sized below `ai:global`; tune per real traffic.
   */
  "ai:provider": {
    kind: "token bucket",
    rate: 1500,
    period: MINUTE,
    capacity: 400,
  },
  /** AI calls are expensive — tight per-user limits. */
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
  "ai:createFinalDraftStream": {
    kind: "fixed window",
    rate: 8,
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
  /*  Social credentials (Buffer)                                        */
  /* ------------------------------------------------------------------ */

  "socialCredentials:set": {
    kind: "token bucket",
    rate: 5,
    period: MINUTE,
    capacity: 2,
  },
  "socialCredentials:rotate": {
    kind: "fixed window",
    rate: 10,
    period: HOUR,
  },
  "socialCredentials:test": {
    kind: "token bucket",
    rate: 20,
    period: MINUTE,
    capacity: 5,
  },
  "socialCredentials:delete": {
    kind: "fixed window",
    rate: 5,
    period: HOUR,
  },
  "socialCredentials:updateConfig": {
    kind: "fixed window",
    rate: 20,
    period: MINUTE,
  },
  "socialPost:test": {
    kind: "token bucket",
    rate: 5,
    period: MINUTE,
    capacity: 3,
  },

  /* ------------------------------------------------------------------ */
  /*  Syndication credentials (dev.to / Hashnode)                        */
  /* ------------------------------------------------------------------ */

  "syndicationCredentials:set": {
    kind: "token bucket",
    rate: 5,
    period: MINUTE,
    capacity: 2,
  },
  "syndicationCredentials:test": {
    kind: "token bucket",
    rate: 20,
    period: MINUTE,
    capacity: 5,
  },
  "syndicationCredentials:delete": {
    kind: "fixed window",
    rate: 5,
    period: HOUR,
  },
  "syndicationCredentials:updateConfig": {
    kind: "fixed window",
    rate: 20,
    period: MINUTE,
  },
  "syndicationPost:test": {
    kind: "token bucket",
    rate: 3,
    period: MINUTE,
    capacity: 2,
  },
  "syndicationPost:retry": {
    kind: "token bucket",
    rate: 5,
    period: MINUTE,
    capacity: 3,
  },

  /* ------------------------------------------------------------------ */
  /*  Analytics (Plausible / Umami)                                      */
  /* ------------------------------------------------------------------ */

  "analytics:connect": {
    kind: "token bucket",
    rate: 5,
    period: MINUTE,
    capacity: 2,
  },
  "analytics:refresh": {
    kind: "token bucket",
    rate: 10,
    period: MINUTE,
    capacity: 4,
  },

  /* ------------------------------------------------------------------ */
  /*  Newsletter (Brevo / Mailchimp)                                     */
  /* ------------------------------------------------------------------ */

  "newsletter:connect": {
    kind: "token bucket",
    rate: 10,
    period: MINUTE,
    capacity: 4,
  },
  "newsletter:edit": {
    kind: "token bucket",
    rate: 60,
    period: MINUTE,
    capacity: 20,
  },
  "newsletter:send": {
    kind: "token bucket",
    rate: 5,
    period: MINUTE,
    capacity: 2,
  },
  "newsletter:test": {
    kind: "token bucket",
    rate: 5,
    period: MINUTE,
    capacity: 3,
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

  /* ------------------------------------------------------------------ */
  /*  Writing stats                                                      */
  /* ------------------------------------------------------------------ */

  "writingStats:setGoal": {
    kind: "fixed window",
    rate: 10,
    period: MINUTE,
  },
  "writingStats:setTimezone": {
    kind: "fixed window",
    rate: 10,
    period: MINUTE,
  },

  /* ------------------------------------------------------------------ */
  /*  Seed                                                               */
  /* ------------------------------------------------------------------ */

  /** Tight cap — seeding is a one-off, accidental loops are the only risk. */
  "seed:run": {
    kind: "fixed window",
    rate: 5,
    period: MINUTE,
  },

  /* ------------------------------------------------------------------ */
  /*  Support tickets                                                    */
  /* ------------------------------------------------------------------ */

  /** Authenticated dashboard form — tight cap, real users don't submit
   *  more than a handful per hour. */
  "support:submitFromDashboard": {
    kind: "fixed window",
    rate: 10,
    period: HOUR,
  },
  /** Marketing form is reachable without auth — tightest bucket. */
  "support:submitFromMarketing": {
    kind: "fixed window",
    rate: 5,
    period: HOUR,
  },
});
