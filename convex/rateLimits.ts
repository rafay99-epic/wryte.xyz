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
import { components } from "./_generated/api";
import type { ActionCtx, MutationCtx } from "./_generated/server";

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
  "documents:importFromGithub": {
    kind: "fixed window",
    rate: 60,
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
  "github:importFile": {
    kind: "fixed window",
    rate: 30,
    period: MINUTE,
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
});
