import { httpRouter } from "convex/server";
import { McpGateway, type RunMutationCtx } from "convex-mcp-gateway";
import { components } from "./_generated/api";
import { httpAction } from "./_generated/server";
import { createAuthorizers } from "./mcp/authorize";
import { preGate } from "./mcp/gate";
import { resources, resourceTemplates } from "./mcp/resources";
import { tools } from "./mcp/tools";

const http = httpRouter();

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

const gateway = new McpGateway(components.mcpGateway);

const INSTRUCTIONS = [
  "Wryte is a writing CMS. Work inside a project: list projects, then documents.",
  "To draft a new post: search existing documents for related work, create the document,",
  "file research findings with wryte_research_create (not in the body), then write the body.",
  "Read wryte://project/{projectId}/frontmatter-schema before writing frontmatter, and",
  "wryte://project/{projectId}/board-columns before setting a status.",
  "List tools are paginated — follow the cursor rather than raising limit.",
  "For substantial rewrites, branch with wryte_drafts_create and promote when done.",
].join(" ");

const MCP_PATH = "/mcp";

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
  const origin =
    process.env["CONVEX_SITE_URL"]?.replace(/\/+$/, "") ??
    new URL(request.url).origin;
  const resourceUrl = `${origin}${MCP_PATH}`;
  if (configuredResourceUrl === resourceUrl) return;
  await gateway.setOAuthConfig(ctx, { authServerUrl, resourceUrl });
  configuredResourceUrl = resourceUrl;
}

const mcp = httpAction(async (ctx, request) => {
  const blocked = await preGate(ctx, request);
  if (blocked) return blocked;

  await ensureOAuthConfig(ctx, request);

  const { authorize, authorizeResource } = createAuthorizers(ctx);

  return await gateway.handleMcpRequest(ctx, request, {
    authorize,
    authorizeResource,
    tools,
    resources,
    resourceTemplates,
    cors: true,
    requireAuth: true,
    initializeInstructions: INSTRUCTIONS,
  });
});

for (const path of ["/mcp/", "/mcp"]) {
  for (const method of ["POST", "GET", "DELETE"] as const) {
    http.route({ path, method, handler: mcp });
  }
}

const protectedResourceMetadata = httpAction(async (ctx, request) => {
  await ensureOAuthConfig(ctx, request);
  return await gateway.serveProtectedResourceMetadata(ctx, request);
});

http.route({
  path: "/.well-known/oauth-protected-resource/mcp",
  method: "GET",
  handler: protectedResourceMetadata,
});
http.route({
  pathPrefix: "/.well-known/oauth-protected-resource/",
  method: "GET",
  handler: protectedResourceMetadata,
});

export default http;
