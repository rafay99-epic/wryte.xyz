import { internal } from "../../../_generated/api";
import type { Doc, Id } from "../../../_generated/dataModel";
import type { MutationCtx } from "../../../_generated/server";
import { countLiveNote } from "./counters";
import { MAX_NOTE_REFS } from "./model";
import { deleteRefRows } from "./refs";
import { deleteSearchRows } from "./search";

export const NOTE_PURGE_BATCH = 20;

export async function purgeNote(
  ctx: MutationCtx,
  note: Doc<"notes">,
): Promise<void> {
  for await (const edge of ctx.db
    .query("note_links")
    .withIndex("by_noteId", (q) => q.eq("noteId", note._id))) {
    await ctx.db.delete(edge._id);
  }
  const content = await ctx.db
    .query("note_content")
    .withIndex("by_noteId", (q) => q.eq("noteId", note._id))
    .unique();
  if (content) await ctx.db.delete(content._id);
  await deleteSearchRows(ctx, note._id, 2);
  await deleteRefRows(ctx, note._id, MAX_NOTE_REFS * 2);
  await ctx.scheduler.runAfter(0, internal.media.noteMedia._purgeForNote, {
    noteId: note._id,
  });
  if (note.trashedAt === undefined) await countLiveNote(ctx, note, "remove");
  await ctx.db.delete(note._id);
}

export async function purgeTrashedNotes(
  ctx: MutationCtx,
  userId: Id<"users">,
): Promise<{ deleted: number; more: boolean }> {
  const trashed = await ctx.db
    .query("notes")
    .withIndex("by_userId_and_trashedAt_and_updatedAt", (q) =>
      q.eq("userId", userId).gt("trashedAt", 0),
    )
    .take(NOTE_PURGE_BATCH);
  for (const note of trashed) {
    await purgeNote(ctx, note);
  }
  return {
    deleted: trashed.length,
    more: trashed.length === NOTE_PURGE_BATCH,
  };
}

export async function wipeNoteRows(
  ctx: MutationCtx,
  noteId: Id<"notes">,
  budget: number,
): Promise<number> {
  let left = budget;
  const links = await ctx.db
    .query("note_links")
    .withIndex("by_noteId", (q) => q.eq("noteId", noteId))
    .take(left);
  for (const row of links) {
    await ctx.db.delete(row._id);
  }
  left -= links.length;
  if (left <= 0) return 0;

  const content = await ctx.db
    .query("note_content")
    .withIndex("by_noteId", (q) => q.eq("noteId", noteId))
    .take(left);
  for (const row of content) {
    await ctx.db.delete(row._id);
  }
  left -= content.length;
  if (left <= 0) return 0;

  left -= await deleteSearchRows(ctx, noteId, left);
  if (left <= 0) return 0;

  left -= await deleteRefRows(ctx, noteId, left);
  if (left <= 0) return 0;

  await ctx.db.delete(noteId);
  return left - 1;
}
