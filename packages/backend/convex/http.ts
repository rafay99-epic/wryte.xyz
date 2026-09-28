import { httpRouter } from "convex/server";
import { McpGateway, type RunMutationCtx } from "convex-mcp-gateway";
import { components } from "./_generated/api";
import { httpAction } from "./_generated/server";
import { createAuthorizers } from "./mcp/authorize";
import { preGate } from "./mcp/gate";
import { MCP_MEDIA_PATH } from "./mcp/handlers/media";
import { mediaUploadRoute } from "./mcp/mediaRoute";
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
  "Wryte is a writing CMS. The user writes the Main version of every post by hand; you add everything around it.",
  "1. Call wryte_project_context once per project and follow it.",
  "2. New post: wryte_documents_create with title, slug and frontmatter. Existing post: wryte_documents_workspace first.",
  "3. Research: wryte_research_create with items[]. Never put research in a draft body.",
  "4. Animations: wryte_animations_upsert. Fix every error it returns, then embed as <Name /> on its own line.",
  "5. Images go to the project's own media provider. File on disk: wryte_media_upload_url, then curl the file to it. Web image: wryte_media_upload with sourceUrl. Paste the returned markdown into the draft.",
  '6. Draft: wryte_drafts_snapshot, labelled "<model> · <harness>". Revise it with wryte_drafts_update.',
  "7. On a rate limit, wait for retryAfter and retry.",
].join("\n");

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

http.route({
  path: MCP_MEDIA_PATH,
  method: "POST",
  handler: mediaUploadRoute,
});

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
