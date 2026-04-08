/**
 * Cron job definitions for background processing.
 * Convex cron jobs run on the server and invoke internal actions on a schedule.
 *
 * Note: Scheduled publishing is now handled by durable workflows
 * (see scheduling.ts) — no cron polling needed.
 */
import { cronJobs } from "convex/server";

const crons = cronJobs();

export default crons;
