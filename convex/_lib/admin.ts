/**
 * Server-side admin gate for Convex actions.
 *
 * Verifies the caller is signed in (Clerk JWT present) AND has
 * `publicMetadata.role === "admin"`. The role check rides the existing
 * Clerk Backend SDK integration in `convex/integrations/clerk.ts` so
 * the Clerk dashboard's Users → Metadata → Public field is the single
 * source of truth — no separate admin table to keep in sync.
 *
 * Use from any `action` that performs an admin-only operation:
 *
 *     export const myAction = action({
 *       args: { ... },
 *       handler: async (ctx, args) => {
 *         const clerkUserId = await requireAdmin(ctx);
 *         // ... do the work, optionally attributing it to clerkUserId
 *       },
 *     });
 *
 * Returns the verified Clerk user id so callers can attribute writes
 * to the acting admin without re-parsing the token.
 */
import { internal } from "../_generated/api";
import type { ActionCtx } from "../_generated/server";
import { parseClerkUserId } from "./auth";

export async function requireAdmin(ctx: ActionCtx): Promise<string> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error("Not authenticated");

  const clerkUserId = parseClerkUserId(identity.tokenIdentifier);
  if (!clerkUserId) throw new Error("Invalid identity token");

  const ok = await ctx.runAction(internal.integrations.clerk._isAdmin, {
    clerkUserId,
  });
  if (!ok) throw new Error("Forbidden — admin role required");

  return clerkUserId;
}
