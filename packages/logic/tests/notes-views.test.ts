import assert from "node:assert/strict";
import type { Id } from "@wryte/backend/_generated/dataModel";
import {
  dayOffset,
  dueLabel,
  dueTone,
  isOverdue,
} from "@wryte/logic/lib/notes/dates";
import {
  groupLookup,
  moveId,
  newNoteArgs,
  noteIdFromPath,
  resolveGroupId,
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

assert.equal(
  dueTone({ status: "todo", dueDate: "2026-09-30" }, today),
  "overdue",
);
assert.equal(dueTone({ status: "doing", dueDate: today }, today), "today");
assert.equal(dueTone({ status: "done", dueDate: today }, today), "later");
assert.equal(
  dueTone({ status: "todo", dueDate: "2026-10-09" }, today),
  "later",
);

assert.deepEqual(moveId(["a", "b", "c"], 0, 1), ["b", "a", "c"]);
assert.deepEqual(moveId(["a", "b", "c"], 2, -2), ["c", "a", "b"]);
assert.deepEqual(moveId(["a", "b", "c"], 0, -1), ["a", "b", "c"]);
assert.deepEqual(moveId(["a", "b", "c"], 2, 1), ["a", "b", "c"]);

assert.equal(noteIdFromPath("/notes"), null);
assert.equal(noteIdFromPath("/notes/"), null);
assert.equal(noteIdFromPath("/notes/abc123"), "abc123");
assert.equal(noteIdFromPath("/notesx/abc"), null);

const groupId = "g1" as Id<"note_groups">;
const note = newNoteArgs("notes", groupId);
assert.equal(note.groupId, groupId);
assert.equal(note.status, undefined);
const task = newNoteArgs("todo", null);
assert.equal(task.status, "todo");
assert.equal("groupId" in task, false);
assert.equal(newNoteArgs("doing", null).status, "doing");

const groups = groupLookup([
  { _id: groupId, name: "Work", sortOrder: 0, noteCount: 3 },
]);
const gone = "gone" as Id<"note_groups">;
assert.equal(resolveGroupId(groupId, groups), groupId);
assert.equal(resolveGroupId(gone, groups), null);
assert.equal(resolveGroupId(gone, undefined), gone);
assert.equal(resolveGroupId(null, groups), null);

console.info("notes-views: all assertions passed");
