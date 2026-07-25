/**
 * MCP handlers for research notes, ideas and snippets — the capture surface an
 * agent uses while drafting.
 *
 * Same contract as `./projects.ts`: `internal*` only, actor injected by the
 * gateway via `identityArg`, zero business logic.
 */
import { v } from "convex/values";
import { mcpCallerValidator } from "convex-mcp-gateway";
import { internalMutation, internalQuery } from "../../_generated/server";
import { requireCaller } from "../../_lib/auth";
import {
  createResearchForUser,
  removeResearchForUser,
  researchForUser,
  updateResearchForUser,
} from "../../cms/documentResearch";

/** Mirrors `researchTypeValidator`, which is module-private in its own file. */
const RESEARCH_TYPE = v.union(
  v.literal("note"),
  v.literal("source"),
  v.literal("quote"),
  v.literal("outline"),
  v.literal("idea"),
  v.literal("ai_summary"),
);

/* ------------------------------ research ------------------------------ */

export const researchList = internalQuery({
  args: { caller: mcpCallerValidator, documentId: v.id("documents") },
  handler: async (ctx, args) => {
    const user = await requireCaller(ctx, args.caller);
    return await researchForUser(ctx, user._id, args.documentId);
  },
});

export const researchCreate = internalMutation({
  args: {
    caller: mcpCallerValidator,
    documentId: v.id("documents"),
    type: RESEARCH_TYPE,
    title: v.string(),
    content: v.string(),
    url: v.optional(v.string()),
    sourceName: v.optional(v.string()),
    selectedForAi: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const user = await requireCaller(ctx, args.caller);
    const { caller: _caller, ...rest } = args;
    return await createResearchForUser(ctx, user, rest);
  },
});

export const researchUpdate = internalMutation({
  args: {
    caller: mcpCallerValidator,
    researchId: v.id("document_research"),
    type: v.optional(RESEARCH_TYPE),
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

export const researchRemove = internalMutation({
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

/* -------------------------------- ideas ------------------------------- */
