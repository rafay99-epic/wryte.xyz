import type { Doc, Id } from "../../../_generated/dataModel";
import type { MutationCtx } from "../../../_generated/server";
import { type StatsDelta, statsDelta } from "./model";

export async function adjustGroupCount(
  ctx: MutationCtx,
  groupId: Id<"note_groups"> | undefined,
  delta: number,
): Promise<void> {
  if (!groupId || delta === 0) return;
  const group = await ctx.db.get(groupId);
  if (!group) return;
  await ctx.db.patch(group._id, {
    noteCount: Math.max(0, group.noteCount + delta),
  });
}

export async function adjustNoteStats(
  ctx: MutationCtx,
  userId: Id<"users">,
  delta: StatsDelta,
): Promise<void> {
  if (delta.todo === 0 && delta.doing === 0) return;
  const row = await ctx.db
    .query("note_stats")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .unique();
  if (row) {
    await ctx.db.patch(row._id, {
      todo: Math.max(0, row.todo + delta.todo),
      doing: Math.max(0, row.doing + delta.doing),
    });
    return;
  }
  await ctx.db.insert("note_stats", {
    userId,
    todo: Math.max(0, delta.todo),
    doing: Math.max(0, delta.doing),
  });
}

export async function countLiveNote(
  ctx: MutationCtx,
  note: Pick<Doc<"notes">, "userId" | "groupId" | "status">,
  direction: "add" | "remove",
): Promise<void> {
  const adding = direction === "add";
  await adjustGroupCount(ctx, note.groupId, adding ? 1 : -1);
  await adjustNoteStats(
    ctx,
    note.userId,
    adding
      ? statsDelta(undefined, note.status)
      : statsDelta(note.status, undefined),
  );
}
