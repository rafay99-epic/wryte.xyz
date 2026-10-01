import { v } from "convex/values";
import { internal } from "../../_generated/api";
import type { Id } from "../../_generated/dataModel";
import type { MutationCtx } from "../../_generated/server";
import { internalMutation, mutation, query } from "../../_generated/server";
import { getAuthedUserOrNull, getCurrentUser } from "../../_lib/auth";
import { requireOwnedGroup } from "./_lib/access";
import {
  createGroupForUser,
  groupsForUser,
  limitGroupWrite,
  MAX_GROUPS,
  normalizeColor,
  normalizeGroupName,
} from "./_lib/groups";
import { groupRowValidator, toGroupRow } from "./_lib/model";
import { NOTE_PURGE_BATCH } from "./_lib/purge";
import { deleteSharesForGroup } from "./_lib/shares";

export const rail = query({
  args: {},
  returns: v.object({
    groups: v.array(groupRowValidator),
    stats: v.object({ todo: v.number(), doing: v.number() }),
  }),
  handler: async (ctx) => {
    const user = await getAuthedUserOrNull(ctx);
    if (!user) return { groups: [], stats: { todo: 0, doing: 0 } };
    const [groups, stats] = await Promise.all([
      groupsForUser(ctx, user._id),
      ctx.db
        .query("note_stats")
        .withIndex("by_userId", (q) => q.eq("userId", user._id))
        .unique(),
    ]);
    return {
      groups: groups.map(toGroupRow),
      stats: { todo: stats?.todo ?? 0, doing: stats?.doing ?? 0 },
    };
  },
});

export const create = mutation({
  args: { name: v.string(), color: v.optional(v.string()) },
  returns: v.id("note_groups"),
  handler: async (ctx, args) =>
    await createGroupForUser(ctx, await getCurrentUser(ctx), args),
});

export const update = mutation({
  args: {
    groupId: v.id("note_groups"),
    name: v.optional(v.string()),
    color: v.optional(v.union(v.string(), v.null())),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    await limitGroupWrite(ctx, user);
    const group = await requireOwnedGroup(ctx, user, args.groupId);
    await ctx.db.patch(group._id, {
      ...(args.name !== undefined
        ? { name: normalizeGroupName(args.name) }
        : {}),
      ...(args.color !== undefined
        ? {
            color: args.color === null ? undefined : normalizeColor(args.color),
          }
        : {}),
    });
    return null;
  },
});

export const reorder = mutation({
  args: { groupIds: v.array(v.id("note_groups")) },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    await limitGroupWrite(ctx, user);
    if (args.groupIds.length > MAX_GROUPS) {
      throw new Error(`You can have at most ${String(MAX_GROUPS)} note groups`);
    }
    const groups = await Promise.all(
      args.groupIds.map((groupId) => requireOwnedGroup(ctx, user, groupId)),
    );
    for (const [sortOrder, group] of groups.entries()) {
      if (group.sortOrder !== sortOrder) {
        await ctx.db.patch(group._id, { sortOrder });
      }
    }
    return null;
  },
});

async function ungroupBatch(
  ctx: MutationCtx,
  userId: Id<"users">,
  groupId: Id<"note_groups">,
): Promise<void> {
  const notes = await ctx.db
    .query("notes")
    .withIndex("by_userId_and_trashedAt_and_groupId_and_updatedAt", (q) =>
      q.eq("userId", userId).eq("trashedAt", undefined).eq("groupId", groupId),
    )
    .take(NOTE_PURGE_BATCH);
  for (const note of notes) {
    await ctx.db.patch(note._id, { groupId: undefined });
  }
  if (notes.length === NOTE_PURGE_BATCH) {
    await ctx.scheduler.runAfter(0, internal.cms.notes.groups._ungroupNotes, {
      userId,
      groupId,
    });
  }
}

export const remove = mutation({
  args: { groupId: v.id("note_groups") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    await limitGroupWrite(ctx, user);
    const group = await requireOwnedGroup(ctx, user, args.groupId);
    await ctx.db.delete(group._id);
    await deleteSharesForGroup(ctx, group._id);
    await ungroupBatch(ctx, user._id, group._id);
    return null;
  },
});

export const _ungroupNotes = internalMutation({
  args: { userId: v.id("users"), groupId: v.id("note_groups") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ungroupBatch(ctx, args.userId, args.groupId);
    return null;
  },
});
