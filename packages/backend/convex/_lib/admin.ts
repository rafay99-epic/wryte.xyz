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
