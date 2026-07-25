/**
 * The single access decision for the MCP server.
 *
 * The gateway is deny-by-default: nothing reaches a tool until this callback
 * returns `{ allowed: true }`. It runs host-side (inside our `httpAction`),
 * which is the only place Convex exposes the JWT-validated identity.
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
 * The gateway invokes this callback **once per registered tool, sequentially**,
 * to filter `tools/list` — which every MCP client calls on every connect. With
 * 37 tools, a naive database read here becomes 37 reads per connect. An earlier
 * draft also called the rate limiter from this callback, which would have been
 * 37 *mutations* per `tools/list`, enough to exhaust a user's own budget just by
 * listing the tools.
 *
 * So `createAuthorize` closes over a lazily-resolved, memoized promise: the
 * grant is fetched at most once per request no matter how many times the
 * callback fires, and not at all for requests that never reach a tool (an
 * `initialize`, say). Rate limiting stays in `gate.ts`, once per request,
 * before the gateway is entered.
 *
 * If you add work here, put it behind the same memo.
 */
import type { McpAuthorizerHandler } from "convex-mcp-gateway";
import { internal } from "../_generated/api";
import { effectiveGrant, type Scope, type WryteToolMetadata } from "./scopes";

/** Minimal slice of the `httpAction` context this needs. */
type GrantCtx = {
  runQuery: (
    ref: typeof internal.mcp.grants._forSubject,
    args: { subject: string },
  ) => Promise<string[] | null>;
};

/**
 * Builds a request-scoped authorizer. Call once per request in the
 * `httpAction`, pass the result to `handleMcpRequest`.
 */
export function createAuthorize(ctx: GrantCtx): McpAuthorizerHandler {
  // Resolved on first use, reused for every subsequent tool in this request.
  let grantPromise: Promise<Set<string> | null> | undefined;

  const grantFor = (subject: string): Promise<Set<string> | null> => {
    grantPromise ??= ctx
      .runQuery(internal.mcp.grants._forSubject, { subject })
      .then((stored) => (stored === null ? null : effectiveGrant(stored)));
    return grantPromise;
  };

  return async (_ctx, { toolMetadata, identity }) => {
    // Anonymous. The gateway maps a reason starting with "Unauth" to a 401 with
    // a `WWW-Authenticate` header, which is the trigger MCP clients need to
    // begin the OAuth discovery flow. Wording matters here.
    if (!identity) {
      return { allowed: false, reason: "Unauthorized" };
    }

    const required =
      (toolMetadata as WryteToolMetadata | undefined)?.scopes ?? [];
    if (required.length === 0) return { allowed: true };

    const granted = await grantFor(identity.subject);

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

    const missing = required.filter((scope: Scope) => !granted.has(scope));
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
}
