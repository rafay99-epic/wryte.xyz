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
import { internalAction } from "./_generated/server";
import { getRateLimitKey, rateLimiter } from "./rateLimits";

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
      // Return null instead of throwing so the resolver can transparently
      // fall through to the vault PAT tier. Genuine misconfiguration
      // (missing secret key) still throws synchronously inside buildClient.
      console.error("[Clerk] GitHub OAuth fetch failed:", err);
      return null;
    }
  },
});
