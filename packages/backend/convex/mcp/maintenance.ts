import { v } from "convex/values";
import { McpGateway } from "convex-mcp-gateway";
import { components, internal } from "../_generated/api";
import { internalMutation } from "../_generated/server";

const gateway = new McpGateway(components.mcpGateway);

const AUDIT_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;

const SESSION_IDLE_MS = 60 * 60 * 1000;

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
