import {
  ConvexError,
  type ObjectType,
  type PropertyValidators,
} from "convex/values";
import {
  type ActionCtx,
  internalAction,
  internalMutation,
  internalQuery,
  type MutationCtx,
  type QueryCtx,
} from "../_generated/server";

const UNCAUGHT_PREFIX = /^(Uncaught \w*Error: )+/;

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function rateLimitMessage(data: unknown): string | null {
  if (typeof data !== "object" || data === null) return null;
  if (Reflect.get(data, "kind") !== "RateLimited") return null;
  const retryAfter: unknown = Reflect.get(data, "retryAfter");
  const seconds =
    typeof retryAfter === "number"
      ? Math.max(1, Math.ceil(retryAfter / 1000))
      : 1;
  return `Rate limited. Retry in ${String(seconds)}s.`;
}

export function toAgentError(error: unknown): Error {
  const data: unknown = error instanceof ConvexError ? error.data : undefined;
  if (typeof data === "string") return new ConvexError(data);

  const message = (
    error instanceof Error ? error.message : String(error)
  ).replace(UNCAUGHT_PREFIX, "");
  const limited = rateLimitMessage(data ?? parseJson(message));
  if (limited !== null) return new ConvexError(limited);

  if (error instanceof ConvexError) return error;
  if (error instanceof Error && error.name === "ConvexError") return error;
  return new ConvexError(message);
}

type Definition<Ctx, Args extends PropertyValidators, Result> = {
  args: Args;
  handler: (ctx: Ctx, args: ObjectType<Args>) => Promise<Result>;
};

async function surfaced<Result>(run: () => Promise<Result>): Promise<Result> {
  try {
    return await run();
  } catch (error) {
    throw toAgentError(error);
  }
}

export function agentQuery<Args extends PropertyValidators, Result>(
  definition: Definition<QueryCtx, Args, Result>,
) {
  return internalQuery({
    args: definition.args,
    handler: (ctx: QueryCtx, args: ObjectType<Args>) =>
      surfaced(() => definition.handler(ctx, args)),
  });
}

export function agentMutation<Args extends PropertyValidators, Result>(
  definition: Definition<MutationCtx, Args, Result>,
) {
  return internalMutation({
    args: definition.args,
    handler: (ctx: MutationCtx, args: ObjectType<Args>) =>
      surfaced(() => definition.handler(ctx, args)),
  });
}

export function agentAction<Args extends PropertyValidators, Result>(
  definition: Definition<ActionCtx, Args, Result>,
) {
  return internalAction({
    args: definition.args,
    handler: (ctx: ActionCtx, args: ObjectType<Args>) =>
      surfaced(() => definition.handler(ctx, args)),
  });
}
