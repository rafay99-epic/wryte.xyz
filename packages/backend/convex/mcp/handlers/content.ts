import { v } from "convex/values";
import { mcpCallerValidator } from "convex-mcp-gateway";
import { requireCaller } from "../../_lib/auth";
import {
  createResearchBatchForUser,
  removeResearchForUser,
  researchForUser,
  researchItemValidator,
  researchTypeValidator,
  updateResearchForUser,
} from "../../cms/documentResearch";
import { agentMutation, agentQuery } from "../agentFunctions";

export const researchList = agentQuery({
  args: { caller: mcpCallerValidator, documentId: v.id("documents") },
  handler: async (ctx, args) => {
    const user = await requireCaller(ctx, args.caller);
    return await researchForUser(ctx, user._id, args.documentId);
  },
});

export const researchCreate = agentMutation({
  args: {
    caller: mcpCallerValidator,
    documentId: v.id("documents"),
    items: v.array(researchItemValidator),
  },
  handler: async (ctx, args) => {
    const user = await requireCaller(ctx, args.caller);
    const { caller: _caller, ...rest } = args;
    return await createResearchBatchForUser(ctx, user, rest);
  },
});

export const researchUpdate = agentMutation({
  args: {
    caller: mcpCallerValidator,
    researchId: v.id("document_research"),
    type: v.optional(researchTypeValidator),
    title: v.optional(v.string()),
    content: v.optional(v.string()),
    url: v.optional(v.string()),
    sourceName: v.optional(v.string()),
    selectedForAi: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const user = await requireCaller(ctx, args.caller);
    const { caller: _caller, ...rest } = args;
    return await updateResearchForUser(ctx, user, rest);
  },
});

export const researchRemove = agentMutation({
  args: {
    caller: mcpCallerValidator,
    researchId: v.id("document_research"),
  },
  handler: async (ctx, args) => {
    const user = await requireCaller(ctx, args.caller);
    return await removeResearchForUser(ctx, user, {
      researchId: args.researchId,
    });
  },
});
