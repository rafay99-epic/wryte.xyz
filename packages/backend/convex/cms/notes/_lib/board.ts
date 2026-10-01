import type { Doc, Id } from "../../../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../../../_generated/server";
import type { DocPatch } from "../../../_lib/docPatch";
import { rateLimiter } from "../../../_lib/rateLimits";
import { loadOwnedNote, requireLiveNote } from "./access";
import { adjustNoteStats } from "./counters";
import {
  BOARD_GAP,
  type BoardCard,
  type BoardColumn,
  boardPositionBetween,
  columnStatus,
  type NoteStatus,
  statsDelta,
  statusPatch,
  toBoardCard,
  topBoardPosition,
} from "./model";

export const BOARD_COLUMN_LIMIT = 25;
export const BOARD_PAGE_LIMIT = 50;
const RENUMBER_LIMIT = 200;

type DbCtx = { db: QueryCtx["db"] };

function columnQuery(
  ctx: DbCtx,
  userId: Id<"users">,
  status: NoteStatus | undefined,
  groupId: Id<"note_groups"> | undefined,
  after: number | undefined,
) {
  const notes = ctx.db.query("notes");
  if (groupId === undefined) {
    return notes.withIndex(
      "by_userId_and_trashedAt_and_status_and_boardPosition",
      (q) => {
        const base = q
          .eq("userId", userId)
          .eq("trashedAt", undefined)
          .eq("status", status);
        return after === undefined ? base : base.gt("boardPosition", after);
      },
    );
  }
  return notes.withIndex(
    "by_userId_and_trashedAt_and_groupId_and_status_and_boardPosition",
    (q) => {
      const base = q
        .eq("userId", userId)
        .eq("trashedAt", undefined)
        .eq("groupId", groupId)
        .eq("status", status);
      return after === undefined ? base : base.gt("boardPosition", after);
    },
  );
}

export async function boardColumn(
  ctx: DbCtx,
  userId: Id<"users">,
  args: {
    column: BoardColumn;
    groupId?: Id<"note_groups">;
    after?: number;
    limit: number;
  },
): Promise<{ cards: BoardCard[]; more: boolean }> {
  const rows = await columnQuery(
    ctx,
    userId,
    columnStatus(args.column),
    args.groupId,
    args.after,
  ).take(args.limit + 1);
  return {
    cards: rows.slice(0, args.limit).map(toBoardCard),
    more: rows.length > args.limit,
  };
}

export async function topOfColumn(
  ctx: DbCtx,
  userId: Id<"users">,
  status: NoteStatus | undefined,
): Promise<number> {
  const first = await ctx.db
    .query("notes")
    .withIndex("by_userId_and_trashedAt_and_status_and_boardPosition", (q) =>
      q
        .eq("userId", userId)
        .eq("trashedAt", undefined)
        .eq("status", status)
        .gte("boardPosition", -Number.MAX_VALUE),
    )
    .first();
  return topBoardPosition(first?.boardPosition);
}

async function neighbor(
  ctx: DbCtx,
  user: Doc<"users">,
  noteId: Id<"notes"> | null | undefined,
  movingId: Id<"notes">,
  status: NoteStatus | undefined,
): Promise<Doc<"notes"> | null> {
  if (noteId === null || noteId === undefined || noteId === movingId) {
    return null;
  }
  const note = await loadOwnedNote(ctx, user, noteId);
  return note && note.trashedAt === undefined && note.status === status
    ? note
    : null;
}

function placementFor(
  above: Doc<"notes"> | null,
  below: Doc<"notes"> | null,
): number | null {
  if (above !== null && above.boardPosition === undefined) return null;
  if (below !== null && below.boardPosition === undefined) return null;
  return boardPositionBetween(
    above?.boardPosition ?? null,
    below?.boardPosition ?? null,
  );
}

async function renumberColumn(
  ctx: MutationCtx,
  userId: Id<"users">,
  status: NoteStatus | undefined,
  moving: Id<"notes">,
  above: Doc<"notes"> | null,
  below: Doc<"notes"> | null,
): Promise<number> {
  const rows = await columnQuery(
    ctx,
    userId,
    status,
    undefined,
    undefined,
  ).take(RENUMBER_LIMIT + 1);
  const tail = rows.length > RENUMBER_LIMIT ? rows.pop() : undefined;
  const order = rows.filter((row) => row._id !== moving);
  const aboveIndex =
    above === null ? -1 : order.findIndex((row) => row._id === above._id);
  const belowIndex =
    below === null ? -1 : order.findIndex((row) => row._id === below._id);
  const index =
    aboveIndex >= 0
      ? aboveIndex + 1
      : belowIndex >= 0
        ? belowIndex
        : above === null && below === null
          ? 0
          : order.length;
  const count = order.length + 1;
  const end = tail?.boardPosition;
  const positionAt = (slot: number) =>
    end === undefined ? slot * BOARD_GAP : end - (count - slot) * BOARD_GAP;
  for (const [slot, row] of order.entries()) {
    const next = positionAt(slot >= index ? slot + 1 : slot);
    if (row.boardPosition !== next) {
      await ctx.db.patch(row._id, { boardPosition: next });
    }
  }
  return positionAt(index);
}

export async function moveNoteOnBoard(
  ctx: MutationCtx,
  user: Doc<"users">,
  args: {
    noteId: Id<"notes">;
    to: BoardColumn;
    beforeId?: Id<"notes"> | null;
    afterId?: Id<"notes"> | null;
    writer: string;
  },
): Promise<{ rev: number; boardPosition: number }> {
  await rateLimiter.limit(ctx, "notes:update", {
    key: user.tokenIdentifier,
    throws: true,
  });
  const note = await requireLiveNote(ctx, user, args.noteId);
  const status = columnStatus(args.to);
  const [above, below] = await Promise.all([
    neighbor(ctx, user, args.beforeId, note._id, status),
    neighbor(ctx, user, args.afterId, note._id, status),
  ]);
  const boardPosition =
    placementFor(above, below) ??
    (await renumberColumn(ctx, user._id, status, note._id, above, below));

  const patch: DocPatch<"notes"> = { boardPosition };
  let rev = note.rev;
  if (status !== note.status) {
    const now = Date.now();
    rev = note.rev + 1;
    Object.assign(patch, statusPatch(note, status ?? null, now), {
      rev,
      writer: args.writer,
      source: "app",
      updatedAt: now,
    });
    await adjustNoteStats(ctx, user._id, statsDelta(note.status, status));
  }
  await ctx.db.patch(note._id, patch);
  return { rev, boardPosition };
}
