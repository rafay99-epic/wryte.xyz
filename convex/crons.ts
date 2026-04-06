/**
 * Cron job definitions for background processing.
 * Convex cron jobs run on the server and invoke internal actions on a schedule.
 */
import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Poll for scheduled documents that are due for publishing every 5 minutes.
// This interval balances responsiveness (max 5 min delay) against unnecessary
// invocations when no work is pending.
crons.interval(
  "process-scheduled-publishes",
  { minutes: 5 },
  internal.scheduling.processScheduled,
);

export default crons;
