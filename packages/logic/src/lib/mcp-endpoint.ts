/**
 * Resolves the public MCP endpoint URL.
 *
 * The endpoint lives on the **Convex site domain**, not on the marketing domain,
 * and that is deliberate: the MCP server is mounted on Convex's HTTP router. Only
 * the agent ever talks to it — Clerk never does — so there's nothing to gain from
 * proxying it through the Next app, and doing so would put the front end back in
 * the request path.
 *
 * Never hardcoded. Two sources, in order:
 *
 *   1. `NEXT_PUBLIC_CONVEX_SITE_URL` — set it explicitly and this is used as-is.
 *      Required if you serve Convex from a custom domain.
 *   2. Derived from `NEXT_PUBLIC_CONVEX_URL` by swapping `.convex.cloud` for
 *      `.convex.site`, which is Convex's own convention. Means a deployment that
 *      only sets the standard Convex var still works.
 *
 * Returns `null` when neither is available, so the caller can say so plainly
 * rather than rendering an empty box or, worse, a wrong URL.
 */
export function resolveMcpEndpoint(): string | null {
  const explicit = process.env["NEXT_PUBLIC_CONVEX_SITE_URL"]?.trim();
  if (explicit) return `${stripTrailingSlash(explicit)}/mcp`;

  const convexUrl = process.env["NEXT_PUBLIC_CONVEX_URL"]?.trim();
  if (convexUrl?.includes(".convex.cloud")) {
    return `${stripTrailingSlash(convexUrl).replace(".convex.cloud", ".convex.site")}/mcp`;
  }

  return null;
}

/**
 * The server advertises its resource identifier without a trailing slash, and
 * RFC 9728 makes clients verify the two match exactly — so a stray slash here
 * would make every connection fail discovery.
 */
function stripTrailingSlash(url: string): string {
  return url.replace(/\/+$/, "");
}
