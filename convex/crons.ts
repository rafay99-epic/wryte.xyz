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

export default crons;
