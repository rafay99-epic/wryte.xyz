/**
 * Pre-gateway gate for `/mcp`.
 *
 * Runs at the very top of the `httpAction`, before `handleMcpRequest`. Returns
 * a `Response` to short-circuit, or `null` to let the request through.
 *
 * ## Why this exists rather than living inside the authorize callback
 *
 * By the time the gateway has a request, it has already spent writes: it looks
 * up (and touches) a session row, and if the authorize callback denies a call
 * to a *known* tool name it records an audit row for the denial. That last one
 * is the sharp edge — an authenticated client with no write scope that hammers
 * `wryte_documents_create` in a loop grows the audit table one row per attempt,
 * and we get billed for every one.
 *
 * Rejecting here instead costs a single rate-limiter write and touches nothing
 * else. Abuse becomes cheap to absorb rather than expensive to log.
 */
import type { GenericActionCtx } from "convex/server";
import type { DataModel } from "../_generated/dataModel";
import { rateLimiter } from "../_lib/rateLimits";

type HttpCtx = GenericActionCtx<DataModel>;

/** RFC 6750 challenge — the trigger MCP clients need to start OAuth. */
function unauthorized(request: Request): Response {
  const origin = new URL(request.url).origin;
  return new Response(
    JSON.stringify({
      jsonrpc: "2.0",
      id: null,
      error: { code: -32001, message: "Unauthorized" },
    }),
    {
      status: 401,
      headers: {
        "content-type": "application/json",
        "www-authenticate": `Bearer resource_metadata="${origin}/.well-known/oauth-protected-resource/mcp"`,
      },
    },
  );
}

function tooManyRequests(retryAfterMs: number): Response {
  return new Response(
    JSON.stringify({
      jsonrpc: "2.0",
      id: null,
      error: { code: -32000, message: "Rate limited. Slow down and retry." },
    }),
    {
      status: 429,
      headers: {
        "content-type": "application/json",
        "retry-after": String(Math.max(1, Math.ceil(retryAfterMs / 1000))),
      },
    },
  );
}

export async function preGate(
  ctx: HttpCtx,
  request: Request,
): Promise<Response | null> {
  // CORS preflight carries no credentials by design — let the gateway answer
  // it. Gating it would break browser clients before they ever authenticate.
  if (request.method === "OPTIONS") return null;

  // Identity check is JWT verification only: no database read, so an
  // unauthenticated flood costs us nothing at all.
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return unauthorized(request);

  // Key on the Clerk subject, not `tokenIdentifier`, so every OAuth client a
  // user registers shares one budget. Registering a new client must not be a
  // way to buy more quota.
  const key = identity.subject;

  // A request with no session header is either `initialize` or an out-of-band
  // call the gateway will reject anyway. `initialize` is the only path that
  // *inserts* a session row, so it gets its own tighter bucket. Deriving this
  // from the header rather than parsing the JSON-RPC body keeps the gate free
  // of body handling — the body can only be consumed once, and the gateway
  // needs it.
  if (!request.headers.get("mcp-session-id")) {
    const init = await rateLimiter.limit(ctx, "mcp:initialize", { key });
    if (!init.ok) return tooManyRequests(init.retryAfter);
  }

  const perUser = await rateLimiter.limit(ctx, "mcp:request", { key });
  if (!perUser.ok) return tooManyRequests(perUser.retryAfter);

  // Unkeyed circuit breaker. Every MCP request costs ~4 mutations and Convex
  // caps concurrent mutations per deployment class, so without this one agent
  // fleet could starve the web app of write throughput.
  const global = await rateLimiter.limit(ctx, "mcp:global", { key: "global" });
  if (!global.ok) return tooManyRequests(global.retryAfter);

  return null;
}
