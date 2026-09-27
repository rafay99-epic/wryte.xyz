export function resolveMcpEndpoint(): string | null {
  const explicit = process.env["NEXT_PUBLIC_CONVEX_SITE_URL"]?.trim();
  if (explicit) return `${stripTrailingSlash(explicit)}/mcp`;

  const convexUrl = process.env["NEXT_PUBLIC_CONVEX_URL"]?.trim();
  if (convexUrl?.includes(".convex.cloud")) {
    return `${stripTrailingSlash(convexUrl).replace(".convex.cloud", ".convex.site")}/mcp`;
  }

  return null;
}

function stripTrailingSlash(url: string): string {
  return url.replace(/\/+$/, "");
}
