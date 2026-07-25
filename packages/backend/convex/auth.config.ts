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
     * Because Convex validates the Bearer *before* any function runs,
     * `ctx.auth.getUserIdentity()` works inside every existing query and
     * mutation. That is what lets MCP tools reuse the app's functions
     * verbatim instead of re-implementing ownership checks.
     *
     * `applicationID` is deliberately absent: with Dynamic Client
     * Registration enabled, every MCP client gets its own `client_id`, so
     * the `aud` claim varies per client and cannot be pinned to one value.
     * The issuer is our own Clerk instance, so this widens the accepted
     * set to *our* users' tokens only — never a third party's. Per-tool
     * authorization is enforced from the `scope` claim in
     * `convex/mcp/authorize.ts`; the token being valid is not the same as
     * the token being allowed.
     */
    {
      type: "customJwt",
      issuer: process.env["CLERK_JWT_ISSUER_DOMAIN"],
      jwks: `${process.env["CLERK_JWT_ISSUER_DOMAIN"]}/.well-known/jwks.json`,
      algorithm: "RS256",
    },
  ],
};
