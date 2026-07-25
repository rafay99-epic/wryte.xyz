import persistentTextStreaming from "@convex-dev/persistent-text-streaming/convex.config";
import rateLimiter from "@convex-dev/rate-limiter/convex.config";
import resend from "@convex-dev/resend/convex.config.js";
import workflow from "@convex-dev/workflow/convex.config.js";
import workpool from "@convex-dev/workpool/convex.config.js";
import { defineApp } from "convex/server";
import mcpGateway from "convex-mcp-gateway/convex.config";

const app = defineApp();
app.use(workflow);
app.use(resend);
app.use(persistentTextStreaming);
app.use(rateLimiter);
app.use(workpool, { name: "githubImportPool" });
// MCP server for coding agents. Owns its own tables (tool registry,
// sessions, audit); the `/mcp` HTTP route, the authorize callback and the
// tool catalog all live in the host — see `convex/mcp/` and `convex/http.ts`.
app.use(mcpGateway);
export default app;
