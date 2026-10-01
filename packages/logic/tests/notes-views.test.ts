import assert from "node:assert/strict";
import type { Id } from "@wryte/backend/_generated/dataModel";
import type { NoteRow } from "@wryte/backend/cms/notes/_lib/model";
import { dayOffset, dueLabel, isOverdue } from "@wryte/logic/lib/notes/dates";
import { nextStatus } from "@wryte/logic/lib/notes/status";
import {
  dueByToday,
  groupLookup,
  moveId,
  newNoteArgs,
  resolveView,
  sortByDue,
} from "@wryte/logic/lib/notes/views";

const today = "2026-10-01";

assert.equal(dayOffset("2026-10-02", today), 1);
assert.equal(dayOffset("2026-11-01", "2026-10-31"), 1);
assert.equal(dayOffset("2026-03-09", "2026-03-08"), 1);
assert.equal(dueLabel(today, today), "Today");
assert.equal(dueLabel("2026-10-02", today), "Tomorrow");
assert.equal(dueLabel("2026-09-30", today), "Yesterday");

assert.equal(isOverdue({ status: "todo", dueDate: "2026-09-30" }, today), true);
assert.equal(
  isOverdue({ status: "doing", dueDate: "2026-09-30" }, today),
  true,
);
assert.equal(
  isOverdue({ status: "done", dueDate: "2026-09-30" }, today),
  false,
);
assert.equal(isOverdue({ status: "todo", dueDate: today }, today), false);
assert.equal(isOverdue({ dueDate: "2026-09-30" }, today), false);

assert.equal(nextStatus("todo"), "doing");
assert.equal(nextStatus("doing"), "done");
assert.equal(nextStatus("done"), "todo");

assert.deepEqual(moveId(["a", "b", "c"], 0, 1), ["b", "a", "c"]);
assert.deepEqual(moveId(["a", "b", "c"], 2, -2), ["c", "a", "b"]);
assert.deepEqual(moveId(["a", "b", "c"], 0, -1), ["a", "b", "c"]);
assert.deepEqual(moveId(["a", "b", "c"], 2, 1), ["a", "b", "c"]);

const groupId = "g1" as Id<"note_groups">;
const groups = groupLookup([
  { _id: groupId, name: "Work", sortOrder: 0, noteCount: 3 },
]);
assert.deepEqual(resolveView({ kind: "group", groupId }, groups), {
  kind: "group",
  groupId,
});
assert.deepEqual(
  resolveView({ kind: "group", groupId: "gone" as Id<"note_groups"> }, groups),
  { kind: "all" },
);

const note = newNoteArgs({ kind: "group", groupId }, "note", today);
assert.equal(note.groupId, groupId);
assert.equal(note.status, undefined);
assert.equal(newNoteArgs({ kind: "all" }, "task", today).status, "todo");
const dueToday = newNoteArgs({ kind: "today" }, "task", today);
assert.equal(dueToday.status, "todo");
assert.equal(dueToday.dueDate, today);
assert.equal(newNoteArgs({ kind: "today" }, "note", today).dueDate, undefined);

function row(id: string, dueDate?: string, updatedAt = 0): NoteRow {
  return {
    _id: id as Id<"notes">,
    title: id,
    excerpt: "",
    wordCount: 0,
    updatedAt,
    status: "todo",
    ...(dueDate !== undefined ? { dueDate } : {}),
  };
}

assert.deepEqual(
  sortByDue([row("none"), row("late", "2026-10-05"), row("soon", today)]).map(
    (r) => r._id,
  ),
  ["soon", "late", "none"],
);

assert.deepEqual(
  dueByToday(
    {
      todo: [row("overdue", "2026-09-20"), row("future", "2026-10-09")],
      doing: [row("now", today), row("undated")],
    },
    today,
  ).map((r) => r._id),
  ["overdue", "now"],
);

console.info("notes-views: all assertions passed");
