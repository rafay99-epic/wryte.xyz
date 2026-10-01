import type { Doc, Id } from "../../../_generated/dataModel";
import type { QueryCtx } from "../../../_generated/server";

type DbCtx = { db: QueryCtx["db"] };

export async function loadOwnedNote(
  ctx: DbCtx,
  user: Doc<"users">,
  noteId: Id<"notes">,
): Promise<Doc<"notes"> | null> {
  const note = await ctx.db.get(noteId);
  return note && note.userId === user._id ? note : null;
}

export async function requireOwnedNote(
  ctx: DbCtx,
  user: Doc<"users">,
  noteId: Id<"notes">,
): Promise<Doc<"notes">> {
  const note = await loadOwnedNote(ctx, user, noteId);
  if (!note) throw new Error("Note not found");
  return note;
}

export async function requireLiveNote(
  ctx: DbCtx,
  user: Doc<"users">,
  noteId: Id<"notes">,
): Promise<Doc<"notes">> {
  const note = await requireOwnedNote(ctx, user, noteId);
  if (note.trashedAt !== undefined) throw new Error("Note is in the trash");
  return note;
}

export async function requireOwnedGroup(
  ctx: DbCtx,
  user: Doc<"users">,
  groupId: Id<"note_groups">,
): Promise<Doc<"note_groups">> {
  const group = await ctx.db.get(groupId);
  if (!group || group.userId !== user._id) {
    throw new Error("Note group not found");
  }
  return group;
}

export async function loadContentRow(
  ctx: DbCtx,
  noteId: Id<"notes">,
): Promise<Doc<"note_content"> | null> {
  return await ctx.db
    .query("note_content")
    .withIndex("by_noteId", (q) => q.eq("noteId", noteId))
    .unique();
}
