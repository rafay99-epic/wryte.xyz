import type {
  McpAuthorizerDecision,
  McpAuthorizerHandler,
  McpResourceAuthorizerHandler,
} from "convex-mcp-gateway";
import { internal } from "../_generated/api";
import type { ActionCtx } from "../_generated/server";
import { SCOPES, type Scope, type WryteToolMetadata } from "./scopes";

function isWryteToolMetadata(value: unknown): value is WryteToolMetadata {
  return (
    typeof value === "object" &&
    value !== null &&
    "scopes" in value &&
    Array.isArray(value.scopes) &&
    value.scopes.length > 0
  );
}

export function createAuthorizers(ctx: Pick<ActionCtx, "runQuery">): {
  authorize: McpAuthorizerHandler;
  authorizeResource: McpResourceAuthorizerHandler;
} {
  let grantPromise: Promise<Set<string> | null> | undefined;

  const grantFor = (subject: string): Promise<Set<string> | null> => {
    grantPromise ??= ctx
      .runQuery(internal.mcp.grants._forSubject, { subject })
      .then((stored) => (stored === null ? null : new Set(stored)));
    return grantPromise;
  };

  const check = async (
    subject: string,
    required: readonly Scope[],
  ): Promise<McpAuthorizerDecision> => {
    const granted = await grantFor(subject);

    if (granted === null) {
      return {
        allowed: false,
        reason:
          "Forbidden: no Wryte account for this identity. Sign in at wryte.xyz once, then reconnect.",
      };
    }

    const missing = required.filter((scope) => !granted.has(scope));
    if (missing.length > 0) {
      return {
        allowed: false,
        reason: `Forbidden: this capability is not enabled for MCP clients (${missing.join(", ")}). Enable it in Wryte settings.`,
      };
    }

    return { allowed: true };
  };

  const authorize: McpAuthorizerHandler = async (
    _ctx,
    { toolMetadata, identity },
  ) => {
    if (!identity) {
      return { allowed: false, reason: "Unauthorized" };
    }
    if (!isWryteToolMetadata(toolMetadata)) {
      return {
        allowed: false,
        reason: "Forbidden: this tool declares no capability.",
      };
    }
    return await check(identity.subject, toolMetadata.scopes);
  };

  const authorizeResource: McpResourceAuthorizerHandler = async (
    _ctx,
    { identity },
  ) => await check(identity.subject, [SCOPES.read]);

  return { authorize, authorizeResource };
}
