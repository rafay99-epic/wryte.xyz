/**
 * Cron job definitions for background processing.
 * Convex cron jobs run on the server and invoke internal actions on a schedule.
 *
 * Note: Scheduled publishing is now handled by durable workflows
 * (see scheduling.ts) — no cron polling needed.
 */
import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

/**
 * Daily sweep of soft-deleted documents. Hard-deletes anything in
 * project trash older than the project's `trashRetentionDays`
 * (default 30). Runs at 03:00 UTC — off-peak for most users; tight
 * enough that an "Empty trash in 30 days" UX promise is accurate.
 *
 * The internal mutation handles the per-project retention math and
 * caps deletions per run; if the system ever has more expired trash
 * than the cap, the remainder drains on subsequent days.
 */
crons.cron(
  "trash:cleanup-expired",
  "0 3 * * *",
  internal.cms.trash._cleanupExpired,
);

/** Daily pruning of the `recentActivity` array on `writing_stats` rows. */
crons.cron(
  "writingStats:prune-activity",
  "5 0 * * *",
  internal.analytics.writingStats._dailyMaintenance,
);

/**
 * Daily sweep of the `ai_stream_owners` bookkeeping table at 03:30 UTC.
 * Deletes ownership rows older than their TTL; the mutation self-reschedules
 * while a full batch remains, so the whole day's backlog drains regardless of
 * volume. Daily (not hourly) keeps cron-trigger overhead minimal — consistent
 * with the 24h patch on the streaming component's own GC. See `ai/aiStreams.ts`.
 */
crons.cron(
  "aiStreams:cleanup-owners",
  "30 3 * * *",
  internal.ai.aiStreams._cleanupOwners,
);

/**
 * MCP gateway retention. Hourly, not daily: both tables grow with agent
 * traffic rather than with user count, and a daily tick would let a busy day
 * accumulate a backlog that takes many chained mutations to drain. Cheap when
 * there's nothing to do (one bounded indexed read), so frequency costs little.
 *
 * Offset from each other and off the hour so they never contend with the
 * 03:00–03:30 cleanup block above.
 */
crons.cron(
  "mcp:prune-audit",
  "10 * * * *",
  internal.mcp.maintenance.pruneAudit,
);
crons.cron(
  "mcp:prune-sessions",
  "40 * * * *",
  internal.mcp.maintenance.pruneSessions,
);

export default crons;
