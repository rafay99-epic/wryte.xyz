import { mcpCallerValidator } from "convex-mcp-gateway";
import { internalQuery } from "../../_generated/server";
import { requireCaller } from "../../_lib/auth";
import { projectsForUser } from "../../cms/projects";

export const list = internalQuery({
  args: { caller: mcpCallerValidator },
  handler: async (ctx, args) => {
    const user = await requireCaller(ctx, args.caller);
    return await projectsForUser(ctx, user._id);
  },
});
