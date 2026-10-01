import { v } from "convex/values";
import type { Doc, Id } from "../../_generated/dataModel";
import type { QueryCtx } from "../../_generated/server";
import { query } from "../../_generated/server";
import { getAuthedUserOrNull } from "../../_lib/auth";
import {
  assertDueDate,
  type CalendarEvent,
  calendarEventValidator,
} from "./_lib/model";

const MAX_EVENTS = 500;

type OpenStatus = "todo" | "doing";

function eventFor(
  note: Doc<"notes">,
  kind: CalendarEvent["kind"],
  timing: { dueDate: string } | { at: number },
): CalendarEvent {
  return {
    noteId: note._id,
    title: note.title,
    kind,
    ...timing,
    ...(note.status !== undefined ? { status: note.status } : {}),
    ...(note.groupId !== undefined ? { groupId: note.groupId } : {}),
  };
}

function dueRange(
  ctx: { db: QueryCtx["db"] },
  userId: Id<"users">,
  status: OpenStatus,
  range: { from: string; to: string } | { before: string },
) {
  return ctx.db
    .query("notes")
    .withIndex("by_userId_and_trashedAt_and_status_and_dueDate", (q) => {
      const base = q
        .eq("userId", userId)
        .eq("trashedAt", undefined)
        .eq("status", status);
      return "before" in range
        ? base.gte("dueDate", "").lt("dueDate", range.before)
        : base.gte("dueDate", range.from).lte("dueDate", range.to);
    });
}

export const month = query({
  args: {
    from: v.string(),
    to: v.string(),
    today: v.string(),
    fromMs: v.number(),
    toMs: v.number(),
  },
  returns: v.array(calendarEventValidator),
  handler: async (ctx, args) => {
    const user = await getAuthedUserOrNull(ctx);
    if (!user) return [];
    assertDueDate(args.from);
    assertDueDate(args.to);
    assertDueDate(args.today);
    if (args.from > args.to || args.fromMs > args.toMs) return [];

    const events: CalendarEvent[] = [];
    const room = () => MAX_EVENTS - events.length;
    const dueFrom = args.from > args.today ? args.from : args.today;
    const statuses: OpenStatus[] = ["todo", "doing"];

    if (dueFrom <= args.to) {
      for (const status of statuses) {
        if (room() <= 0) break;
        const notes = await dueRange(ctx, user._id, status, {
          from: dueFrom,
          to: args.to,
        }).take(room());
        for (const note of notes) {
          events.push(eventFor(note, "due", { dueDate: note.dueDate ?? "" }));
        }
      }
    }

    for (const status of statuses) {
      if (room() <= 0) break;
      const notes = await dueRange(ctx, user._id, status, {
        before: args.today,
      }).take(room());
      for (const note of notes) {
        events.push(eventFor(note, "overdue", { dueDate: note.dueDate ?? "" }));
      }
    }

    if (room() > 0) {
      const done = await ctx.db
        .query("notes")
        .withIndex("by_userId_and_trashedAt_and_completedAt", (q) =>
          q
            .eq("userId", user._id)
            .eq("trashedAt", undefined)
            .gte("completedAt", args.fromMs)
            .lte("completedAt", args.toMs),
        )
        .take(room());
      for (const note of done) {
        events.push(eventFor(note, "done", { at: note.completedAt ?? 0 }));
      }
    }

    if (room() > 0) {
      const opened = await ctx.db
        .query("notes")
        .withIndex("by_userId_and_trashedAt_and_taskOpenedAt", (q) =>
          q
            .eq("userId", user._id)
            .eq("trashedAt", undefined)
            .gte("taskOpenedAt", args.fromMs)
            .lte("taskOpenedAt", args.toMs),
        )
        .take(room());
      for (const note of opened) {
        events.push(eventFor(note, "opened", { at: note.taskOpenedAt ?? 0 }));
      }
    }

    return events;
  },
});
