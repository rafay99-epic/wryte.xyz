/**
 * HTTP endpoints exposed by the Convex backend.
 * These are accessible at the deployment's HTTP URL (not the WebSocket API).
 */
import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";

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

export default http;
