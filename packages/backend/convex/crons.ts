import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.cron(
  "trash:cleanup-expired",
  "0 3 * * *",
  internal.cms.trash._cleanupExpired,
  {},
);

crons.cron(
  "notes:purge-expired-trash",
  "15 3 * * *",
  internal.cms.notes.notes._purgeExpiredTrash,
  {},
);

crons.cron(
  "writingStats:prune-activity",
  "5 0 * * *",
  internal.analytics.writingStats._dailyMaintenance,
  {},
);

crons.cron(
  "aiStreams:cleanup-owners",
  "30 3 * * *",
  internal.ai.aiStreams._cleanupOwners,
);

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
