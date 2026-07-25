/**
 * Reading the MCP audit log.
 *
 * The gateway component does **not** enforce read authorization on its own
 * audit table — its docs say so explicitly, and `listEntries` is a plain
 * query. So this is the only place that reads it, and it filters to rows
 * belonging to the caller before returning anything.
 *
 * That filtering is why `limit` is applied *after* the ownership filter: the
 * component's own limit applies to the pre-filter scan, so asking it for 50
 * rows on a multi-user deployment could return zero of the caller's own.
 */
import { v } from "convex/values";
import { McpGateway } from "convex-mcp-gateway";
import { components } from "../_generated/api";
import { query } from "../_generated/server";
import { getAuthedUserOrNull } from "../_lib/auth";

const gateway = new McpGateway(components.mcpGateway);

/** Scan window into the shared audit table when filtering by subject. */
const SCAN_LIMIT = 1000;

export const recentActivity = query({
  args: { limit: v.optional(v.number()) },
  returns: v.array(
    v.object({
      toolName: v.optional(v.string()),
      outcome: v.string(),
      at: v.number(),
      durationMs: v.number(),
      errorMessage: v.optional(v.string()),
    }),
  ),
  handler: async (ctx, args) => {
    const user = await getAuthedUserOrNull(ctx);
    if (!user?.clerkUserId) return [];

    const limit = Math.min(Math.max(args.limit ?? 50, 1), 200);
    const entries = await gateway.listAuditEntries(ctx, { limit: SCAN_LIMIT });

    return entries
      .filter((entry) => entry.identitySubject === user.clerkUserId)
      .slice(0, limit)
      .map((entry) => ({
        ...(entry.toolName !== undefined ? { toolName: entry.toolName } : {}),
        outcome: entry.outcome,
        at: entry._creationTime,
        durationMs: entry.durationMs,
        ...(entry.errorMessage !== undefined
          ? { errorMessage: entry.errorMessage }
          : {}),
      }));
  },
});
