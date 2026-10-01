import assert from "node:assert/strict";
import type { Id } from "@wryte/backend/_generated/dataModel";
import type { BoardCard } from "@wryte/backend/cms/notes/_lib/model";
import {
  type BoardSnapshot,
  insertCard,
  mergeColumns,
  pageCursor,
  placeCard,
  placementAt,
  withoutCard,
} from "@wryte/logic/lib/notes/board";

function card(
  id: string,
  boardPosition?: number,
  extra: Partial<BoardCard> = {},
): BoardCard {
  return {
    _id: id as Id<"notes">,
    title: id,
    excerpt: "",
    refCounts: { pr: 0, issue: 0, comment: 0, link: 0 },
    updatedAt: 0,
    ...(boardPosition !== undefined ? { boardPosition } : {}),
    ...extra,
  };
}

const ids = (cards: readonly BoardCard[]) => cards.map((item) => item._id);

function snapshot(
  todo: BoardCard[],
  more = false,
  done: BoardCard[] = [],
): BoardSnapshot {
  return {
    columns: { notes: [], todo, doing: [], done },
    more: { notes: false, todo: more, doing: false, done: false },
  };
}

const paged = snapshot([card("a", 0), card("b", 1024)], true, [
  card("x", 0, { status: "done" }),
]);
assert.deepEqual(
  ids(
    mergeColumns(paged, {
      todo: [card("b", 1024), card("stale", 500), card("c", 2048)],
    }).todo,
  ),
  ["a", "b", "c"],
);
assert.deepEqual(ids(mergeColumns(paged, { todo: [card("x", 4096)] }).todo), [
  "a",
  "b",
]);
assert.deepEqual(
  ids(mergeColumns(snapshot([card("a", 0)]), { todo: [card("c", 99)] }).todo),
  ["a"],
);

assert.equal(pageCursor([card("a", 0), card("b", 1024)]), 1024);
assert.equal(pageCursor([card("a")]), -Number.MAX_VALUE);

const column = [card("a", 0), card("b", 1024), card("c", 2048)];
assert.deepEqual(placementAt(column, 0), { beforeId: null, afterId: "b" });
assert.deepEqual(placementAt(column, 2), { beforeId: "b", afterId: null });

const now = 1_000;
const todo = card("t", 10, { status: "todo", dueDate: "2026-10-02" });
assert.equal(
  placeCard(todo, "todo", undefined, undefined, now).boardPosition,
  0,
);
assert.equal(
  placeCard(todo, "todo", undefined, card("b", 1024), now).boardPosition,
  0,
);
assert.equal(
  placeCard(todo, "todo", card("a", 0), undefined, now).boardPosition,
  1024,
);
assert.equal(
  placeCard(todo, "todo", card("a", 0), card("b", 1024), now).boardPosition,
  512,
);

const finished = placeCard(todo, "done", undefined, undefined, now);
assert.equal(finished.status, "done");
assert.equal(finished.completedAt, now);
assert.equal(finished.dueDate, "2026-10-02");

const reopened = placeCard(finished, "doing", undefined, undefined, 2_000);
assert.equal(reopened.status, "doing");
assert.equal("completedAt" in reopened, false);

const kept = placeCard(finished, "done", undefined, undefined, 2_000);
assert.equal(kept.completedAt, now);

const plain = placeCard(finished, "notes", undefined, undefined, now);
assert.equal("status" in plain, false);
assert.equal("dueDate" in plain, false);
assert.equal("completedAt" in plain, false);

const board = snapshot([card("a", 0), card("b", 1024)], false, [
  card("d", 0, { status: "done" }),
]).columns;
const moved = card("d", 512, { status: "todo" });
assert.deepEqual(
  ids(insertCard(board, moved, "todo", "a" as Id<"notes">).todo),
  ["a", "d", "b"],
);
assert.deepEqual(ids(insertCard(board, moved, "todo", null).todo), [
  "d",
  "a",
  "b",
]);
assert.deepEqual(insertCard(board, moved, "todo", null).done, []);
assert.deepEqual(
  ids(insertCard(board, moved, "todo", "far" as Id<"notes">).todo),
  ["a", "b"],
);

assert.deepEqual(
  ids(
    withoutCard({ todo: [card("a"), card("b")] }, "a" as Id<"notes">).todo ??
      [],
  ),
  ["b"],
);

console.info("notes-board: all assertions passed");
