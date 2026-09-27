/**
 * Convex auth configuration — bridges Clerk authentication with Convex.
 * The `domain` is the Clerk JWT issuer URL (set via environment variable),
 * and "convex" is the audience value that Clerk includes in JWTs issued
 * specifically for this Convex backend. This allows `ctx.auth.getUserIdentity()`
 * to verify and decode Clerk-issued tokens in every query/mutation.
 */
export default {
  providers: [
    {
      domain: process.env["CLERK_JWT_ISSUER_DOMAIN"],
      applicationID: "convex",
    },
    /**
     * Clerk OAuth 2.0 access tokens, presented by MCP clients against
     * `/mcp` (see `convex/mcp/`). Clerk issues these as RS256 JWTs signed
     * by the same instance key as session tokens, so Convex verifies them
     * locally against the same JWKS — no introspection round trip.
     *
     * Only the `/mcp` `httpAction` actually needs this provider: `preGate`
     * and the gateway read the caller via `ctx.auth.getUserIdentity()`
     * there, and every tool and resource runs as an internal handler that
     * receives the caller as an injected argument rather than through
     * `ctx.auth` (except the board-columns resource, which still calls a
     * public query from that `httpAction`; see `convex/mcp/resources.ts`).
     *
     * `applicationID` is deliberately absent: with Dynamic Client
     * Registration enabled, every MCP client gets its own `client_id`, so
     * the `aud` claim varies per client and cannot be pinned to one value.
     * The issuer is our own Clerk instance, so this widens the accepted
     * set to *our* users' tokens only — never a third party's. MCP
     * capability is enforced from the per-user grant (`users.mcpScopes`) in
     * `convex/mcp/authorize.ts`, not from any token claim.
     *
     * Known gap: Convex applies auth config deployment-wide, so a token
     * accepted here also authenticates the app's *public* functions as that
     * user, outside the MCP capability grant.
     */
    {
      type: "customJwt",
      issuer: process.env["CLERK_JWT_ISSUER_DOMAIN"],
      jwks: `${process.env["CLERK_JWT_ISSUER_DOMAIN"]}/.well-known/jwks.json`,
      algorithm: "RS256",
    },
  ],
};
