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
  ],
};
