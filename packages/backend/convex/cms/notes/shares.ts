import { v } from "convex/values";
import { internalMutation, mutation, query } from "../../_generated/server";
import { getAuthedUserOrNull, getCurrentUser } from "../../_lib/auth";
import {
  shareBodiesValidator,
  shareCreatedValidator,
  shareExpiryValidator,
  shareKindValidator,
  shareRowValidator,
  shareViewValidator,
} from "./_lib/shareModel";
import {
  createShareForUser,
  listSharesForUser,
  revokeShareForUser,
  shareBodies,
  viewShare,
} from "./_lib/shares";

export const create = mutation({
  args: {
    kind: shareKindValidator,
    noteIds: v.optional(v.array(v.id("notes"))),
    groupId: v.optional(v.id("note_groups")),
    title: v.optional(v.string()),
    expiresInDays: v.optional(shareExpiryValidator),
  },
  returns: shareCreatedValidator,
  handler: async (ctx, args) =>
    await createShareForUser(ctx, await getCurrentUser(ctx), args),
});

export const list = query({
  args: {},
  returns: v.array(shareRowValidator),
  handler: async (ctx) => {
    const user = await getAuthedUserOrNull(ctx);
    if (!user) return [];
    return await listSharesForUser(ctx, user);
  },
});

export const revoke = mutation({
  args: { shareId: v.id("note_shares") },
  returns: v.null(),
  handler: async (ctx, args) =>
    await revokeShareForUser(ctx, await getCurrentUser(ctx), args.shareId),
});

export const view = query({
  args: { token: v.string() },
  returns: shareViewValidator,
  handler: async (ctx, args) => await viewShare(ctx, args.token),
});

export const bodies = query({
  args: { token: v.string(), noteIds: v.array(v.id("notes")) },
  returns: shareBodiesValidator,
  handler: async (ctx, args) =>
    await shareBodies(ctx, args.token, args.noteIds),
});

export const _expire = internalMutation({
  args: { shareId: v.id("note_shares") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const share = await ctx.db.get(args.shareId);
    if (share) await ctx.db.delete(share._id);
    return null;
  },
});
