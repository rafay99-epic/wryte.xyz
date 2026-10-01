import type { GenericActionCtx } from "convex/server";
import type { DataModel } from "../_generated/dataModel";
import { rateLimiter } from "../_lib/rateLimits";
import { retryMessage, retrySeconds } from "./retry";

type HttpCtx = GenericActionCtx<DataModel>;

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
      error: { code: -32000, message: retryMessage(retryAfterMs) },
    }),
    {
      status: 429,
      headers: {
        "content-type": "application/json",
        "retry-after": String(retrySeconds(retryAfterMs)),
      },
    },
  );
}

export async function preGate(
  ctx: HttpCtx,
  request: Request,
): Promise<Response | null> {
  if (request.method === "OPTIONS") return null;

  const identity = await ctx.auth.getUserIdentity().catch(() => null);
  if (!identity) return unauthorized(request);

  const key = identity.subject;

  if (!request.headers.get("mcp-session-id")) {
    const init = await rateLimiter.limit(ctx, "mcp:initialize", { key });
    if (!init.ok) return tooManyRequests(init.retryAfter);
  }

  const perUser = await rateLimiter.limit(ctx, "mcp:request", { key });
  if (!perUser.ok) return tooManyRequests(perUser.retryAfter);

  const global = await rateLimiter.limit(ctx, "mcp:global", { key: "global" });
  if (!global.ok) return tooManyRequests(global.retryAfter);

  return null;
}
