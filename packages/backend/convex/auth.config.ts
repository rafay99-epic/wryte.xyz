export default {
  providers: [
    {
      domain: process.env["CLERK_JWT_ISSUER_DOMAIN"],
      applicationID: "convex",
    },
    {
      type: "customJwt",
      issuer: process.env["CLERK_JWT_ISSUER_DOMAIN"],
      jwks: `${process.env["CLERK_JWT_ISSUER_DOMAIN"]}/.well-known/jwks.json`,
      algorithm: "RS256",
    },
  ],
};
