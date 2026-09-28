import { v } from "convex/values";
import { mcpCallerValidator } from "convex-mcp-gateway";
import { requireCaller } from "../../_lib/auth";
import { rateLimiter } from "../../_lib/rateLimits";
import { agentMutation } from "../agentFunctions";

export const MCP_MEDIA_PATH = "/mcp/media";

const TICKET_TTL_MS = 10 * 60 * 1000;
const EXPIRED_SWEEP = 20;

export const uploadUrl = agentMutation({
  args: {
    caller: mcpCallerValidator,
    projectId: v.id("projects"),
    documentId: v.optional(v.id("documents")),
    filename: v.optional(v.string()),
    alt: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireCaller(ctx, args.caller);
    await rateLimiter.limit(ctx, "media:upload", {
      key: user.tokenIdentifier,
      throws: true,
    });

    const project = await ctx.db.get(args.projectId);
    if (!project || project.userId !== user._id) {
      throw new Error("Project not found");
    }
    if (args.documentId !== undefined) {
      const document = await ctx.db.get(args.documentId);
      if (!document || document.projectId !== args.projectId) {
        throw new Error("Post not found in this project");
      }
    }

    const siteUrl = process.env["CONVEX_SITE_URL"]?.replace(/\/+$/, "");
    if (!siteUrl) throw new Error("CONVEX_SITE_URL is not set");

    const now = Date.now();
    const expired = await ctx.db
      .query("mcp_upload_tickets")
      .withIndex("by_userId_and_expiresAt", (q) =>
        q.eq("userId", user._id).lt("expiresAt", now),
      )
      .take(EXPIRED_SWEEP);
    for (const ticket of expired) await ctx.db.delete(ticket._id);

    const token = `${crypto.randomUUID()}${crypto.randomUUID()}`.replaceAll(
      "-",
      "",
    );
    const expiresAt = now + TICKET_TTL_MS;
    const { caller: _caller, ...ticket } = args;
    await ctx.db.insert("mcp_upload_tickets", {
      ...ticket,
      token,
      userId: user._id,
      expiresAt,
    });

    const uploadUrl = `${siteUrl}${MCP_MEDIA_PATH}?ticket=${token}`;
    return {
      uploadUrl,
      expiresAt,
      usage: `curl -X POST -H "Content-Type: image/png" --data-binary @cover.png "${uploadUrl}". Single use, valid 10 minutes. The file goes straight to the project's media provider and the JSON response has url and markdown.`,
    };
  },
});

export const redeemTicket = agentMutation({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const ticket = await ctx.db
      .query("mcp_upload_tickets")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .unique();
    if (!ticket) return null;
    await ctx.db.delete(ticket._id);
    return ticket.expiresAt < Date.now() ? null : ticket;
  },
});
