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
 * Each gateway prune call deletes one bounded batch (~200 rows) and returns
 * the count. Component calls run inside the calling mutation's transaction, so
 * looping several batches in one mutation stacks their writes against a single
 * transaction's limits and can abort before anything is rescheduled. Instead
 * each invocation prunes exactly one batch and, if it deleted anything,
 * schedules itself again; the chain ends on the first empty batch.
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

/**
 * Runs one prune batch and reports whether another may be needed. The caller
 * reschedules itself on `true`.
 */
async function pruneOneBatch(
  label: string,
  prune: () => Promise<number>,
): Promise<boolean> {
  const deleted = await prune();
  if (deleted > 0) console.info(`[mcp] pruned ${deleted} ${label}`);
  return deleted > 0;
}

export const pruneAudit = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const more = await pruneOneBatch("audit entries", () =>
      gateway.pruneAuditEntries(ctx, AUDIT_RETENTION_MS),
    );
    if (more) {
      await ctx.scheduler.runAfter(0, internal.mcp.maintenance.pruneAudit, {});
    }
    return null;
  },
});

export const pruneSessions = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const more = await pruneOneBatch("idle sessions", () =>
      gateway.pruneSessions(ctx, SESSION_IDLE_MS),
    );
    if (more) {
      await ctx.scheduler.runAfter(
        0,
        internal.mcp.maintenance.pruneSessions,
        {},
      );
    }
    return null;
  },
});
