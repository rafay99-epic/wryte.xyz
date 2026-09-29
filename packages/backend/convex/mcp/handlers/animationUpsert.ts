"use node";

import { v } from "convex/values";
import { mcpCallerValidator } from "convex-mcp-gateway";
import ts from "typescript6";
import { internal } from "../../_generated/api";
import type { Id } from "../../_generated/dataModel";
import { createAnimationChecker } from "../../_lib/animationChecker/run";
import {
  type AnimationCheckLevel,
  type AnimationCheckStatus,
  type AnimationDiagnostic,
  type AnimationLanguage,
  summarizeDiagnostics,
  type TypecheckState,
} from "../../_lib/animationChecks";
import {
  normalizeAnimationName,
  validateAnimationSource,
} from "../../_lib/animationInput";
import { agentAction } from "../agentFunctions";

const runChecks = createAnimationChecker(async () => ts);

type UpsertCheck =
  | { status: "skipped" }
  | {
      status: AnimationCheckStatus;
      errorCount: number;
      warningCount: number;
      typecheck: TypecheckState;
      diagnostics: AnimationDiagnostic[];
    };

async function checkSource(
  policy: { level: AnimationCheckLevel; language: AnimationLanguage },
  source: string,
): Promise<UpsertCheck> {
  if (policy.level === "off") return { status: "skipped" };

  const result = await runChecks({
    level: policy.level,
    language: policy.language,
    source,
  });
  if (result.kind === "failed") {
    throw new Error(`Animation checks could not run: ${result.error}`);
  }
  return {
    ...summarizeDiagnostics(result.diagnostics),
    typecheck: result.typecheck,
    diagnostics: result.diagnostics,
  };
}

export const upsert = agentAction({
  args: {
    caller: mcpCallerValidator,
    projectId: v.id("projects"),
    name: v.string(),
    source: v.string(),
    dryRun: v.optional(v.boolean()),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{
    animationId: Id<"animations"> | null;
    created: boolean;
    check: UpsertCheck;
  }> => {
    const name = normalizeAnimationName(args.name);
    const source = validateAnimationSource(args.source);
    const policy = await ctx.runQuery(internal.mcp.handlers.animations.policy, {
      caller: args.caller,
      projectId: args.projectId,
    });

    const check = await checkSource(policy, source);

    if (args.dryRun) return { animationId: null, created: false, check };

    const recordable =
      check.status !== "skipped" && check.typecheck.kind !== "unavailable";
    const written = await ctx.runMutation(
      internal.mcp.handlers.animations.write,
      {
        caller: args.caller,
        projectId: args.projectId,
        name,
        source,
        ...(recordable
          ? {
              check: {
                status: check.status,
                errorCount: check.errorCount,
                warningCount: check.warningCount,
              },
            }
          : {}),
      },
    );
    return { ...written, check };
  },
});
