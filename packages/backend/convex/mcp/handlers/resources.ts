/**
 * MCP handlers backing the resource templates in `../resources.ts`.
 *
 * Same auth path as the tool handlers: `internal*` only, actor passed in from
 * the identity the gateway resolved host-side, resolved with `requireCaller`.
 * See `_lib/auth.ts → requireCaller` for why.
 *
 * Ids arrive as raw strings extracted from a resource URI, so each handler
 * validates them with `normalizeId` and returns `null` (resource not found)
 * for anything that isn't an id of the right table.
 */
import { v } from "convex/values";
import { mcpCallerValidator } from "convex-mcp-gateway";
import { internalQuery } from "../../_generated/server";
import { requireCaller } from "../../_lib/auth";
import { documentWithContentForUser } from "../../cms/documents";

/**
 * One owned project row, for the frontmatter-schema resource. Throws on a
 * foreign project, like the public `cms/projects.get`, so an agent can't probe
 * for other people's project ids.
 */
export const project = internalQuery({
  args: { caller: mcpCallerValidator, projectId: v.string() },
  handler: async (ctx, args) => {
    const user = await requireCaller(ctx, args.caller);
    const projectId = ctx.db.normalizeId("projects", args.projectId);
    if (!projectId) return null;
    const project = await ctx.db.get(projectId);
    if (!project) return null;
    if (project.userId !== user._id) {
      throw new Error("Unauthorized: you do not own this project");
    }
    return project;
  },
});

/** One owned document with its body, for the document resource. */
export const document = internalQuery({
  args: { caller: mcpCallerValidator, documentId: v.string() },
  handler: async (ctx, args) => {
    const user = await requireCaller(ctx, args.caller);
    const documentId = ctx.db.normalizeId("documents", args.documentId);
    if (!documentId) return null;
    return await documentWithContentForUser(ctx, user._id, documentId);
  },
});
