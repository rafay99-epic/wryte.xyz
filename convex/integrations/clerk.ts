/**
 * Clerk Backend SDK wrapper for Convex actions.
 *
 * Convex actions need GitHub OAuth tokens at fire-time — for example, when
 * a scheduled publish wakes up weeks after it was created. The Next.js
 * route `/api/github/token` is unreachable from server-side workflow code,
 * so we call Clerk directly with `@clerk/backend`.
 *
 * Pure Node action — the Clerk Backend SDK uses standard Node primitives
 * and does not depend on Next.js request context.
 */
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

/**
 * Returns a fresh GitHub OAuth access token for the given Clerk user, or
 * `null` if the user has not connected GitHub (or Clerk can't issue a
 * token for some other reason). Callers should fall through to the vault
 * PAT fallback when this returns null.
 *
 * Internal-only — the user identity is established by the caller through
 * their own Convex auth, then a trusted `clerkUserId` is forwarded here.
 */
export const _getGithubOauthToken = internalAction({
  args: { clerkUserId: v.string() },
  handler: async (ctx, args): Promise<string | null> => {
    // Rate-limit check: if we've burned through the bucket, return null so
    // the resolver falls through to the vault tier instead of bubbling a
    // rate-limit error up to the publish action. `throws: false` makes the
    // limiter return `{ok: false, retryAfter}` so we can inspect it.
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
      // Clerk dropped the "oauth_" prefix on provider names. Passing
      // "oauth_github" still works but logs a deprecation warning that
      // will become a hard error in the next major SDK release.
      const resp = await clerk.users.getUserOauthAccessToken(
        args.clerkUserId,
        "github",
      );
      const token = resp.data[0]?.token;
      // `||` instead of `??` so a defensively empty string from Clerk also
      // falls through to the next tier rather than being treated as a
      // valid (but auth-failing) token at the GitHub API call.
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
        // Configuration mismatch: the SDK key and the JWT issuer point at
        // different Clerk apps. Surface a precise hint, then fall through to
        // the vault tier — the legacy PAT may still work.
        console.error(
          `[Clerk] GitHub OAuth fetch failed: Clerk user ${args.clerkUserId} not found in the Clerk app that CLERK_SECRET_KEY belongs to. CLERK_SECRET_KEY and CLERK_JWT_ISSUER_DOMAIN must be from the same Clerk app — see https://clerk.com/docs/guides/development/integrations/databases/convex`,
        );
        return null;
      }

      // 401/403 = the user really doesn't have a connected GitHub OAuth
      // identity in this Clerk app, or the SDK key lost its access.
      // Falling through to the vault tier is correct.
      if (clerkErr.status === 401 || clerkErr.status === 403) {
        console.error("[Clerk] GitHub OAuth fetch unauthorized:", err);
        return null;
      }

      // Anything else (network, 5xx, 408 timeout) is transient. Throwing
      // lets the workflow's retry policy kick in instead of silently
      // demoting the user to a stale or empty vault PAT.
      throw err;
    }
  },
});

/**
 * Returns true if the given Clerk user has `publicMetadata.role === "admin"`.
 * Source of truth for admin gates on staff-only Convex mutations (e.g.
 * the changelog writer functions). The role is set from the Clerk
 * dashboard under Users → {user} → Metadata → Public → `{ "role":
 * "admin" }`.
 *
 * Internal-only — callers establish the Convex user identity through
 * `ctx.auth.getUserIdentity()` and forward the trusted `clerkUserId`
 * here. Returns `false` (rather than throwing) for any failure so the
 * caller can render a friendly "forbidden" error.
 */
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
