import type { Doc, Id } from "../../../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../../../_generated/server";
import { searchText } from "./model";

type DbCtx = { db: QueryCtx["db"] };

async function loadSearchRow(
  ctx: DbCtx,
  noteId: Id<"notes">,
): Promise<Doc<"note_search"> | null> {
  return await ctx.db
    .query("note_search")
    .withIndex("by_noteId", (q) => q.eq("noteId", noteId))
    .unique();
}

export async function writeSearchText(
  ctx: MutationCtx,
  note: Pick<Doc<"notes">, "_id" | "userId" | "trashedAt">,
  content: string,
): Promise<void> {
  const text = searchText(content);
  const trashed = note.trashedAt !== undefined;
  const row = await loadSearchRow(ctx, note._id);
  if (!row) {
    await ctx.db.insert("note_search", {
      noteId: note._id,
      userId: note.userId,
      trashed,
      text,
    });
    return;
  }
  if (row.text === text && row.trashed === trashed) return;
  await ctx.db.patch(row._id, { text, trashed });
}

export async function setSearchTrashed(
  ctx: MutationCtx,
  noteId: Id<"notes">,
  trashed: boolean,
): Promise<void> {
  const row = await loadSearchRow(ctx, noteId);
  if (row && row.trashed !== trashed) await ctx.db.patch(row._id, { trashed });
}

export async function deleteSearchRows(
  ctx: MutationCtx,
  noteId: Id<"notes">,
  budget: number,
): Promise<number> {
  const rows = await ctx.db
    .query("note_search")
    .withIndex("by_noteId", (q) => q.eq("noteId", noteId))
    .take(budget);
  for (const row of rows) {
    await ctx.db.delete(row._id);
  }
  return rows.length;
}
