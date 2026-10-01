import type { Doc, Id } from "../../../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../../../_generated/server";
import { rateLimiter } from "../../../_lib/rateLimits";
import { requireLiveNote } from "./access";
import {
  countRefKinds,
  EMPTY_REF_COUNTS,
  MAX_NOTE_REFS,
  type NoteRef,
  normalizeRef,
  type RefInput,
  sameRef,
  toNoteRef,
} from "./model";

type DbCtx = { db: QueryCtx["db"] };

async function refRows(
  ctx: DbCtx,
  user: Doc<"users">,
  noteId: Id<"notes">,
): Promise<Doc<"note_refs">[]> {
  const rows = await ctx.db
    .query("note_refs")
    .withIndex("by_noteId", (q) => q.eq("noteId", noteId))
    .take(MAX_NOTE_REFS);
  return rows.filter((row) => row.userId === user._id);
}

export async function refsForNote(
  ctx: DbCtx,
  user: Doc<"users">,
  noteId: Id<"notes">,
): Promise<NoteRef[]> {
  return (await refRows(ctx, user, noteId)).map(toNoteRef);
}

async function limitRefWrite(
  ctx: MutationCtx,
  user: Doc<"users">,
): Promise<void> {
  await rateLimiter.limit(ctx, "notes:refs", {
    key: user.tokenIdentifier,
    throws: true,
  });
}

export async function addRefs(
  ctx: MutationCtx,
  user: Doc<"users">,
  noteId: Id<"notes">,
  refs: RefInput[],
): Promise<Id<"note_refs">[]> {
  if (refs.length === 0) return [];
  await limitRefWrite(ctx, user);
  const wanted = refs.map(normalizeRef);
  const note = await requireLiveNote(ctx, user, noteId);
  const existing = (await refRows(ctx, user, note._id)).map(toNoteRef);
  const fresh: RefInput[] = [];
  for (const ref of wanted) {
    if ([...existing, ...fresh].some((other) => sameRef(other, ref))) continue;
    fresh.push(ref);
  }
  const total = existing.length + fresh.length;
  if (total > MAX_NOTE_REFS) {
    throw new Error(
      `A note can have at most ${String(MAX_NOTE_REFS)} refs. It has ${String(existing.length)}; remove some first.`,
    );
  }
  if (fresh.length === 0) return [];
  const now = Date.now();
  const ids: Id<"note_refs">[] = [];
  for (const ref of fresh) {
    ids.push(
      await ctx.db.insert("note_refs", {
        noteId: note._id,
        userId: user._id,
        createdAt: now,
        ...ref,
      }),
    );
  }
  await ctx.db.patch(note._id, {
    refCounts: countRefKinds([...existing, ...fresh]),
  });
  return ids;
}

export async function removeRef(
  ctx: MutationCtx,
  user: Doc<"users">,
  refId: Id<"note_refs">,
): Promise<null> {
  await limitRefWrite(ctx, user);
  const ref = await ctx.db.get(refId);
  if (!ref || ref.userId !== user._id) throw new Error("Ref not found");
  await ctx.db.delete(ref._id);
  const note = await ctx.db.get(ref.noteId);
  if (note) {
    const counts = { ...(note.refCounts ?? EMPTY_REF_COUNTS) };
    counts[ref.kind] = Math.max(0, counts[ref.kind] - 1);
    await ctx.db.patch(note._id, { refCounts: counts });
  }
  return null;
}

export async function deleteRefRows(
  ctx: MutationCtx,
  noteId: Id<"notes">,
  budget: number,
): Promise<number> {
  const rows = await ctx.db
    .query("note_refs")
    .withIndex("by_noteId", (q) => q.eq("noteId", noteId))
    .take(budget);
  for (const row of rows) {
    await ctx.db.delete(row._id);
  }
  return rows.length;
}
