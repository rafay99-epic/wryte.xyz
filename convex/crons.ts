import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.interval(
  "process-scheduled-publishes",
  { minutes: 5 },
  internal.scheduling.processScheduled,
);

export default crons;
