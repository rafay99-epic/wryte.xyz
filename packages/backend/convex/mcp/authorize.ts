/**
 * The access decisions for the MCP server: one for tools, one for resources.
 *
 * Both are deny-by-default: nothing reaches a tool or resource until the
 * matching callback returns `{ allowed: true }`. They run host-side (inside
 * our `httpAction`), which is the only place Convex exposes the JWT-validated
 * identity.
 *
 * ## Where the capability set comes from
 *
 * Not from the token. Clerk has no custom OAuth scopes (see `./scopes.ts`), so
 * every access token carries only `openid profile email` — nothing that could
 * distinguish read from publish. Capability is the per-user grant in
 * `users.mcpScopes`, read through `grants._forSubject`.
 *
 * ## The read is memoized per request, and that is load-bearing
 *
 * The gateway invokes the tool callback **once per registered tool,
 * sequentially**, to filter `tools/list` — which every MCP client calls on
 * every connect. With every tool in the catalog, a naive database read here
 * becomes one read per tool per connect. An earlier draft also called the rate
 * limiter from this callback, which would have been one *mutation* per tool per
 * `tools/list`, enough to exhaust a user's own budget just by listing the
 * tools.
 *
 * So `createAuthorizers` closes over a lazily-resolved, memoized promise: the
 * grant is fetched at most once per request no matter how many times either
 * callback fires, and not at all for requests that never reach a tool or
 * resource (an `initialize`, say). Rate limiting stays in `gate.ts`, once per
 * request, before the gateway is entered.
 *
 * If you add work here, put it behind the same memo.
 */
import type {
  McpAuthorizerDecision,
  McpAuthorizerHandler,
  McpResourceAuthorizerHandler,
} from "convex-mcp-gateway";
import { internal } from "../_generated/api";
import type { ActionCtx } from "../_generated/server";
import { SCOPES, type Scope, type WryteToolMetadata } from "./scopes";

/**
 * Narrows the gateway's opaque `toolMetadata` to our declared shape. Anything
 * else (absent, malformed, empty scope list) is treated as a catalog bug and
 * denied rather than waved through.
 */
function isWryteToolMetadata(value: unknown): value is WryteToolMetadata {
  return (
    typeof value === "object" &&
    value !== null &&
    "scopes" in value &&
    Array.isArray(value.scopes) &&
    value.scopes.length > 0
  );
}

/**
 * Builds the request-scoped tool and resource authorizers. Call once per
 * request in the `httpAction`, pass both to `handleMcpRequest`.
 */
export function createAuthorizers(ctx: Pick<ActionCtx, "runQuery">): {
  authorize: McpAuthorizerHandler;
  authorizeResource: McpResourceAuthorizerHandler;
} {
  // Resolved on first use, reused for every subsequent check in this request.
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

    // Valid token, but no `users` row for this Clerk subject. Happens when
    // someone authorizes an agent before ever signing in on the web, since the
    // row is created by the web app's `users.getOrCreate`. Every tool would
    // fail deeper in with "User not found" anyway; saying so here is clearer
    // and cheaper.
    if (granted === null) {
      return {
        allowed: false,
        reason:
          "Forbidden: no Wryte account for this identity. Sign in at wryte.xyz once, then reconnect.",
      };
    }

    const missing = required.filter((scope) => !granted.has(scope));
    if (missing.length > 0) {
      // "Forbidden", not "Unauthorized" — the token is fine, the capability
      // just isn't enabled. A 401 would make the client discard a working token
      // and re-run OAuth, which cannot help: the fix is a toggle in Wryte's
      // settings, not a fresh token.
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
    // Anonymous. The gateway maps a reason starting with "Unauth" to a 401 with
    // a `WWW-Authenticate` header, which is the trigger MCP clients need to
    // begin the OAuth discovery flow. Wording matters here.
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

  // Every resource is read-only context, so `read` gates all of them. The
  // gateway passes `resourceMetadata: null` for template reads, so this keys on
  // nothing per-resource: a new resource is covered without declaring anything.
  const authorizeResource: McpResourceAuthorizerHandler = async (
    _ctx,
    { identity },
  ) => await check(identity.subject, [SCOPES.read]);

  return { authorize, authorizeResource };
}
