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
import { action, internalAction } from "../_generated/server";
import { parseClerkUserId } from "../_lib/auth";
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
      // 404 with `resource_not_found` is the single most common failure
      // mode and the most confusing one: it means the Clerk Backend SDK
      // is authenticated against a *different* Clerk app than the one
      // issuing the user's JWT. Surface a hint so the next person
      // doesn't spend an hour wondering why a signed-in user "doesn't
      // exist". Every other failure (network, 5xx, scope) gets the
      // generic console.error and falls through to the vault tier.
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
      } else {
        console.error("[Clerk] GitHub OAuth fetch failed:", err);
      }
      return null;
    }
  },
});

/**
 * One-shot diagnostic for the Clerk SDK ↔ Convex integration. Run it
 * from the Convex dashboard's function runner (or call it from the
 * client) to find out which side of the connection is misbehaving:
 *
 *   - "incoming JWT" → the identity Convex extracted from your session
 *   - "outgoing SDK"  → what Clerk's Backend SDK reports when we look
 *                       you up by that same user id
 *   - "sdk smoke test"→ a user-list call that proves the secret key
 *                       authenticates to *some* Clerk app (regardless
 *                       of whether your user lives in it)
 *
 * If the JWT user id matches the SDK lookup → integration is correct.
 * If the JWT user id is non-null but the SDK lookup 404s → JWT and
 * secret key belong to different Clerk apps. The smoke test will tell
 * you whether the secret key is valid at all.
 */
export const debugAuth = action({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();

    const parsedClerkUserId = identity?.tokenIdentifier
      ? parseClerkUserId(identity.tokenIdentifier)
      : null;

    const report: Record<string, unknown> = {
      incomingJwt: identity
        ? {
            tokenIdentifier: identity.tokenIdentifier,
            subject: identity.subject,
            issuer: identity.issuer,
            parsedClerkUserId,
          }
        : null,
    };

    let clerk: ReturnType<typeof createClerkClient>;
    try {
      clerk = createClerkClient({
        secretKey: process.env["CLERK_SECRET_KEY"] ?? "",
      });
    } catch (err) {
      report["sdkInit"] = {
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      };
      return report;
    }

    // 1. Does the secret key authenticate at all?
    try {
      const list = await clerk.users.getUserList({ limit: 1 });
      report["sdkSmokeTest"] = {
        ok: true,
        totalUsersInApp: list.totalCount,
        // First user ID in the app — if your JWT's user_id matches
        // this app, you should be able to find your own ID listed
        // somewhere in this Clerk instance.
        firstUserIdSeen: list.data[0]?.id ?? null,
      };
    } catch (err) {
      report["sdkSmokeTest"] = {
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }

    // 2. Look up the JWT's user id via SDK.
    if (parsedClerkUserId) {
      try {
        const user = await clerk.users.getUser(parsedClerkUserId);
        report["sdkUserLookup"] = {
          ok: true,
          userId: user.id,
          primaryEmail: user.emailAddresses[0]?.emailAddress ?? null,
        };
      } catch (err) {
        report["sdkUserLookup"] = {
          ok: false,
          error: err instanceof Error ? err.message : String(err),
        };
      }
    } else {
      report["sdkUserLookup"] = {
        ok: false,
        error: "No parsable Clerk user id from JWT",
      };
    }

    return report;
  },
});
