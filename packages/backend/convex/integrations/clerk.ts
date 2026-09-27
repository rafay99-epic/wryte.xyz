"use node";

import { createClerkClient } from "@clerk/backend";
import { v } from "convex/values";
import { internalAction } from "../_generated/server";
import { getRateLimitKey, rateLimiter } from "../_lib/rateLimits";

function buildClient() {
  const secretKey = process.env["CLERK_SECRET_KEY"];
  if (!secretKey) {
    throw new Error(
      "CLERK_SECRET_KEY is not configured. Run `npx convex env set CLERK_SECRET_KEY=...` so Convex actions can fetch fresh OAuth tokens from Clerk.",
    );
  }
  return createClerkClient({ secretKey });
}

export const _getGithubOauthToken = internalAction({
  args: { clerkUserId: v.string() },
  handler: async (ctx, args): Promise<string | null> => {
    const key = await getRateLimitKey(ctx);
    const limit = await rateLimiter.limit(ctx, "clerk:getOauthToken", { key });
    if (!limit.ok) {
      console.warn(
        `[Clerk] OAuth fetch skipped — rate limit hit (retry in ${limit.retryAfter}ms). Falling back to vault.`,
      );
      return null;
    }

    try {
      const clerk = buildClient();
      const resp = await clerk.users.getUserOauthAccessToken(
        args.clerkUserId,
        "github",
      );
      const token = resp.data[0]?.token;
      return token || null;
    } catch (err) {
      const clerkErr = err as {
        status?: number;
        errors?: Array<{ code?: string }>;
      };
      const isUserNotFound =
        clerkErr.status === 404 &&
        clerkErr.errors?.some((e) => e.code === "resource_not_found");
      if (isUserNotFound) {
        console.error(
          `[Clerk] GitHub OAuth fetch failed: Clerk user ${args.clerkUserId} not found in the Clerk app that CLERK_SECRET_KEY belongs to. CLERK_SECRET_KEY and CLERK_JWT_ISSUER_DOMAIN must be from the same Clerk app — see https://clerk.com/docs/guides/development/integrations/databases/convex`,
        );
        return null;
      }

      if (clerkErr.status === 401 || clerkErr.status === 403) {
        console.error("[Clerk] GitHub OAuth fetch unauthorized:", err);
        return null;
      }

      throw err;
    }
  },
});

export const _isAdmin = internalAction({
  args: { clerkUserId: v.string() },
  handler: async (_ctx, args): Promise<boolean> => {
    try {
      const clerk = buildClient();
      const user = await clerk.users.getUser(args.clerkUserId);
      const role = (user.publicMetadata as { role?: unknown } | null)?.role;
      return role === "admin";
    } catch (err) {
      console.error("[Clerk] _isAdmin lookup failed:", err);
      return false;
    }
  },
});
