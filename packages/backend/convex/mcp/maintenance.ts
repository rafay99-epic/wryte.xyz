/**
 * Retention for the MCP gateway's own tables.
 *
 * The component runs no background work by design — it owns the tables but the
 * host owns the schedule. Two of those tables grow with traffic and neither is
 * self-limiting:
 *
 *   - `audit`: one row per `tools/call`, plus one per denied call to a known
 *     tool name. Unbounded without pruning.
 *   - `sessions`: one row per `initialize`. Never garbage-collected by the
 *     component, so without this an abandoned agent session lives forever.
 *
 * Both prune functions delete up to ~200 rows per mutation (bounded to stay
 * inside Convex's per-mutation write limits) and return the count, so the
 * caller loops until they return 0. Where a single cron tick can't drain the
 * backlog we re-schedule rather than raising the batch size — the batch is
 * fixed by the component, so calling more often is the only real knob.
 */
import { v } from "convex/values";
import { McpGateway } from "convex-mcp-gateway";
import { components, internal } from "../_generated/api";
import { internalMutation } from "../_generated/server";

const gateway = new McpGateway(components.mcpGateway);

/**
 * Audit retention. Seven days: long enough to answer "an agent did something
 * unexpected last week, what was it", short enough that the table stays small
 * and each prune is cheap. Extend if the forensic window ever matters more
 * than the storage.
 */
const AUDIT_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;

/** Idle sessions older than this are dead — MCP clients re-`initialize`. */
const SESSION_IDLE_MS = 60 * 60 * 1000;

/** Loop guard: at ~200 rows per call this drains 20k rows per tick. */
const MAX_BATCHES_PER_TICK = 100;

export const pruneAudit = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    let total = 0;
    for (let batch = 0; batch < MAX_BATCHES_PER_TICK; batch++) {
      const deleted = await gateway.pruneAuditEntries(ctx, AUDIT_RETENTION_MS);
      if (deleted === 0) {
        if (total > 0) console.info(`[mcp] pruned ${total} audit entries`);
        return null;
      }
      total += deleted;
    }
    // Hit the batch ceiling with rows still expired — chain instead of
    // stretching one mutation past its write budget.
    console.warn(
      `[mcp] audit prune hit the batch ceiling after ${total} rows; rescheduling`,
    );
    await ctx.scheduler.runAfter(0, internal.mcp.maintenance.pruneAudit, {});
    return null;
  },
});

export const pruneSessions = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    let total = 0;
    for (let batch = 0; batch < MAX_BATCHES_PER_TICK; batch++) {
      const deleted = await gateway.pruneSessions(ctx, SESSION_IDLE_MS);
      if (deleted === 0) {
        if (total > 0) console.info(`[mcp] pruned ${total} idle sessions`);
        return null;
      }
      total += deleted;
    }
    console.warn(
      `[mcp] session prune hit the batch ceiling after ${total} rows; rescheduling`,
    );
    await ctx.scheduler.runAfter(0, internal.mcp.maintenance.pruneSessions, {});
    return null;
  },
});
