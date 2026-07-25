/**
 * HTTP endpoints exposed by the Convex backend.
 * These are accessible at the deployment's HTTP URL (not the WebSocket API).
 */
import { httpRouter } from "convex/server";
import { McpGateway, type RunMutationCtx } from "convex-mcp-gateway";
import { components } from "./_generated/api";
import { httpAction } from "./_generated/server";
import { createAuthorize } from "./mcp/authorize";
import { preGate } from "./mcp/gate";
import { resources, resourceTemplates } from "./mcp/resources";
import { tools } from "./mcp/tools";

const http = httpRouter();

// Simple health check endpoint for uptime monitoring and deployment verification.
// Returns a 200 JSON response with no auth requirement.
http.route({
  path: "/health",
  method: "GET",
  handler: httpAction(async () => {
    return new Response(JSON.stringify({ status: "ok" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }),
});

/* ------------------------------------------------------------------ */
/*  MCP server                                                         */
/* ------------------------------------------------------------------ */

const gateway = new McpGateway(components.mcpGateway);

/**
 * Server-level guidance returned in the MCP `initialize` result. This is the
 * cheapest place to teach the model how Wryte is shaped: one short paragraph
 * here beats repeating the same context across ~35 tool descriptions, all of
 * which sit in the context window on every turn.
 *
 * Per the spec, clients MAY use it — so it's a strong hint, not a constraint.
 * Anything that must hold is enforced in `authorize` or the tools themselves.
 */
const INSTRUCTIONS = [
  "Wryte is a writing CMS. Work inside a project: list projects, then documents.",
  "To draft a new post: search existing documents for related work, create the document,",
  "file research findings with wryte_research_create (not in the body), then write the body.",
  "Read wryte://project/{projectId}/frontmatter-schema before writing frontmatter, and",
  "wryte://project/{projectId}/board-columns before setting a status.",
  "List tools are paginated — follow the cursor rather than raising limit.",
  "For substantial rewrites, branch with wryte_drafts_create and promote when done.",
].join(" ");

/**
 * The OAuth authorization server is Clerk. Written once, lazily: the config
 * lives in a component table, and `CONVEX_SITE_URL` is unavailable in
 * deploy-time hooks but present inside an `httpAction` — so the first request
 * is the only reliable place to set it.
 *
 * The module-level flag makes this a no-op for the rest of the isolate's life;
 * a cold start pays one extra mutation.
 *
 * It is called from the **discovery** route, not from `/mcp` before the gate.
 * That ordering is the fix for a chicken-and-egg that made the whole OAuth flow
 * unreachable on a cold deployment: `preGate` 401s an anonymous client before
 * any config write, the 401 points the client at the discovery URL, and
 * discovery answered `404 OAuth discovery not configured` — so the client could
 * never learn where Clerk is and never started the flow. Discovery is the route
 * that actually needs the config, is unauthenticated by design, and is hit once
 * per client connect, so writing it there costs nothing and keeps the
 * under-attack path on `/mcp` free of writes.
 *
 * ## `resourceUrl` must be set explicitly, without a trailing slash
 *
 * RFC 9728 makes the client verify that the `resource` in the metadata document
 * matches the resource identifier it is using, exactly. Left to derive the
 * value itself the gateway force-appends a trailing slash
 * (`buildResourceUrl`), advertising `…/mcp/` — so a client registered as
 * `…/mcp` rejects the document outright:
 *
 *     Protected resource http://…/mcp/ does not match expected http://…/mcp
 *
 * There is one canonical identifier and it has to be picked, since satisfying
 * both spellings at once is impossible. No-slash wins: it is what
 * `claude mcp add … /mcp` registers, and the gateway's own docs note that
 * claude.ai strips the trailing slash before POSTing. Both routes stay mounted,
 * so either spelling still *works* — this only fixes what we advertise.
 */
const MCP_PATH = "/mcp";

/** Last `resourceUrl` written, so a changed origin rewrites and a stable one doesn't. */
let configuredResourceUrl: string | null = null;

async function ensureOAuthConfig(
  ctx: RunMutationCtx,
  request: Request,
): Promise<void> {
  const authServerUrl = process.env["CLERK_JWT_ISSUER_DOMAIN"];
  if (!authServerUrl) {
    console.error(
      "[mcp] CLERK_JWT_ISSUER_DOMAIN is unset — OAuth discovery will 404 " +
        "and MCP clients cannot begin the auth flow.",
    );
    return;
  }
  // Origin comes from the request so the same code is correct on localhost and
  // on the deployed `.convex.site` domain without an extra env var to keep in
  // sync.
  const resourceUrl = `${new URL(request.url).origin}${MCP_PATH}`;
  if (configuredResourceUrl === resourceUrl) return;
  await gateway.setOAuthConfig(ctx, { authServerUrl, resourceUrl });
  configuredResourceUrl = resourceUrl;
}

const mcp = httpAction(async (ctx, request) => {
  // Runs before the gateway on purpose: the gateway spends writes (session
  // touch, and an audit row when a known tool is denied) before any policy is
  // applied, so unauthenticated and rate-limited traffic is rejected here,
  // where it costs one rate-limiter write instead of three writes and an action.
  const blocked = await preGate(ctx, request);
  if (blocked) return blocked;

  // Authenticated past this point, so a config write is safe to attach here
  // too — covers the case where a client arrives with a token already cached
  // and never touches the discovery route.
  await ensureOAuthConfig(ctx, request);

  return await gateway.handleMcpRequest(ctx, request, {
    // Request-scoped: closes over a memoized capability-grant lookup, so the
    // 37 authorize calls behind a single `tools/list` cost one database read.
    authorize: createAuthorize(ctx),
    tools,
    resources,
    resourceTemplates,
    cors: true,
    // Redundant while `preGate` above rejects anonymous callers, and kept
    // deliberately as a second line. Without it, an anonymous request that
    // ever reached the gateway would get an empty tools/list inside an HTTP
    // 200 — which browser clients read as "connected, no tools available" and
    // never start OAuth, since a 401 is their only trigger. Cheap insurance
    // against someone reordering the gate.
    requireAuth: true,
    initializeInstructions: INSTRUCTIONS,
  });
});

// Mount both spellings: some clients (claude.ai among them) strip the trailing
// slash from the configured URL before POSTing.
for (const path of ["/mcp/", "/mcp"]) {
  for (const method of ["POST", "GET", "DELETE"] as const) {
    http.route({ path, method, handler: mcp });
  }
}

// RFC 9728 protected-resource metadata: how a client discovers that Clerk is
// the authorization server. It never has to be told out of band.
const protectedResourceMetadata = httpAction(async (ctx, request) => {
  // Must run here: this is the route a 401'd anonymous client follows, and
  // without the config it answers 404 and the OAuth flow never begins.
  await ensureOAuthConfig(ctx, request);
  return await gateway.serveProtectedResourceMetadata(ctx, request);
});

http.route({
  path: "/.well-known/oauth-protected-resource/mcp",
  method: "GET",
  handler: protectedResourceMetadata,
});
// Convex requires a trailing slash on `pathPrefix` routes. Covers the
// sub-resource form some clients construct.
http.route({
  pathPrefix: "/.well-known/oauth-protected-resource/",
  method: "GET",
  handler: protectedResourceMetadata,
});

export default http;
