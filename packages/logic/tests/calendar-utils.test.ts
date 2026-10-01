import assert from "node:assert/strict";
import {
  getDateKey,
  groupNoteEventsByDay,
  monthRange,
  noteEventDateKey,
} from "@wryte/logic/lib/calendar-utils";

const february = monthRange(2028, 1, "2028-02-10");
assert.equal(february.from, "2028-02-01");
assert.equal(february.to, "2028-02-29");
assert.equal(february.today, "2028-02-10");
assert.equal(february.fromMs, new Date(2028, 1, 1).getTime());
assert.equal(february.toMs, new Date(2028, 2, 1).getTime() - 1);
assert.equal(getDateKey(new Date(february.toMs)), "2028-02-29");

const december = monthRange(2026, 11, "2026-10-01");
assert.equal(december.from, "2026-12-01");
assert.equal(december.to, "2026-12-31");
assert.equal(getDateKey(new Date(december.toMs + 1)), "2027-01-01");

const today = "2026-10-01";
const lateEvening = new Date(2026, 9, 3, 23, 30).getTime();

assert.equal(
  noteEventDateKey({ kind: "overdue", dueDate: "2026-09-20" }, today),
  today,
);
assert.equal(
  noteEventDateKey({ kind: "due", dueDate: "2026-10-12" }, today),
  "2026-10-12",
);
assert.equal(
  noteEventDateKey({ kind: "done", at: lateEvening }, today),
  "2026-10-03",
);
assert.equal(noteEventDateKey({ kind: "opened" }, today), null);

const grouped = groupNoteEventsByDay(
  [
    { id: "a", kind: "done" as const, at: new Date(2026, 9, 1, 9).getTime() },
    { id: "b", kind: "overdue" as const, dueDate: "2026-09-28" },
    { id: "c", kind: "due" as const, dueDate: "2026-10-01" },
    { id: "d", kind: "opened" as const, at: lateEvening },
    { id: "e", kind: "due" as const },
  ],
  today,
);
assert.deepEqual(
  grouped.get(today)?.map((event) => event.id),
  ["b", "c", "a"],
);
assert.deepEqual(
  grouped.get("2026-10-03")?.map((event) => event.id),
  ["d"],
);
assert.equal(grouped.size, 2);

console.info("calendar-utils: all assertions passed");
