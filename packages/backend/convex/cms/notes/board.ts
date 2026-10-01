import { v } from "convex/values";
import { mutation, query } from "../../_generated/server";
import { getAuthedUserOrNull, getCurrentUser } from "../../_lib/auth";
import {
  BOARD_COLUMN_LIMIT,
  BOARD_PAGE_LIMIT,
  boardColumn,
  moveNoteOnBoard,
} from "./_lib/board";
import { boardCardValidator, boardColumnValidator } from "./_lib/model";

const columnsValidator = v.object({
  notes: v.array(boardCardValidator),
  todo: v.array(boardCardValidator),
  doing: v.array(boardCardValidator),
  done: v.array(boardCardValidator),
});

const moreValidator = v.object({
  notes: v.boolean(),
  todo: v.boolean(),
  doing: v.boolean(),
  done: v.boolean(),
});

const EMPTY_BOARD = {
  columns: { notes: [], todo: [], doing: [], done: [] },
  more: { notes: false, todo: false, doing: false, done: false },
};

export const board = query({
  args: { groupId: v.optional(v.id("note_groups")) },
  returns: v.object({ columns: columnsValidator, more: moreValidator }),
  handler: async (ctx, args) => {
    const user = await getAuthedUserOrNull(ctx);
    if (!user) return EMPTY_BOARD;
    const load = (column: "notes" | "todo" | "doing" | "done") =>
      boardColumn(ctx, user._id, {
        column,
        limit: BOARD_COLUMN_LIMIT,
        ...(args.groupId !== undefined ? { groupId: args.groupId } : {}),
      });
    const [notes, todo, doing, done] = await Promise.all([
      load("notes"),
      load("todo"),
      load("doing"),
      load("done"),
    ]);
    return {
      columns: {
        notes: notes.cards,
        todo: todo.cards,
        doing: doing.cards,
        done: done.cards,
      },
      more: {
        notes: notes.more,
        todo: todo.more,
        doing: doing.more,
        done: done.more,
      },
    };
  },
});

export const column = query({
  args: {
    status: boardColumnValidator,
    groupId: v.optional(v.id("note_groups")),
    after: v.number(),
    limit: v.number(),
  },
  returns: v.object({ cards: v.array(boardCardValidator), more: v.boolean() }),
  handler: async (ctx, args) => {
    const user = await getAuthedUserOrNull(ctx);
    if (!user) return { cards: [], more: false };
    const limit = Math.max(
      1,
      Math.min(BOARD_PAGE_LIMIT, Math.floor(args.limit)),
    );
    return await boardColumn(ctx, user._id, {
      column: args.status,
      after: args.after,
      limit,
      ...(args.groupId !== undefined ? { groupId: args.groupId } : {}),
    });
  },
});

export const move = mutation({
  args: {
    noteId: v.id("notes"),
    to: boardColumnValidator,
    beforeId: v.optional(v.union(v.id("notes"), v.null())),
    afterId: v.optional(v.union(v.id("notes"), v.null())),
    writer: v.string(),
  },
  returns: v.object({ rev: v.number(), boardPosition: v.number() }),
  handler: async (ctx, args) =>
    await moveNoteOnBoard(ctx, await getCurrentUser(ctx), args),
});
