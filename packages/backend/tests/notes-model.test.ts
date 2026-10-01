import { test } from "bun:test";
import assert from "node:assert/strict";
import { shouldTouch, TOUCH_INTERVAL_MS } from "../convex/_lib/touch";
import {
  appendText,
  assertNoteSize,
  BOARD_GAP,
  boardPositionBetween,
  buildExcerpt,
  isDueDate,
  MAX_NOTE_BYTES,
  normalizeRef,
  SEARCH_TEXT_BYTES,
  sameRef,
  searchText,
  snippet,
  statsDelta,
  statusPatch,
  TEXT_PREVIEW_LENGTH,
  topBoardPosition,
} from "../convex/cms/notes/_lib/model";

test("shouldTouch throttles to once a minute unless flushed or retitled", () => {
  const base = { updatedAt: 1_000, flush: false, titleChanged: false };
  assert.equal(shouldTouch({ ...base, now: 11_000 }), false);
  assert.equal(shouldTouch({ ...base, now: 1_000 + TOUCH_INTERVAL_MS }), true);
  assert.equal(shouldTouch({ ...base, now: 2_000, flush: true }), true);
  assert.equal(shouldTouch({ ...base, now: 2_000, titleChanged: true }), true);
});

test("buildExcerpt strips markdown and caps length", () => {
  assert.equal(
    buildExcerpt(
      "# Title\n\nSome **bold** and _italic_ text with a [link](https://x.y) and ![img](a.png).",
    ),
    "Title Some bold and italic text with a link and .",
  );
  assert.equal(
    buildExcerpt("```ts\nconst snake_case = 1;\n```\n- item\n> quote"),
    "const snake_case = 1; item quote",
  );
  const long = buildExcerpt("word ".repeat(200));
  assert.equal(long.length, TEXT_PREVIEW_LENGTH);
  assert.ok(long.endsWith("…"));
  assert.equal(buildExcerpt("   \n\n  "), "");
});

test("statusPatch handles every transition", () => {
  const now = 42;
  assert.deepEqual(statusPatch({}, "todo", now), {
    status: "todo",
    taskOpenedAt: now,
  });
  assert.deepEqual(statusPatch({}, "done", now), {
    status: "done",
    taskOpenedAt: now,
    completedAt: now,
  });
  assert.deepEqual(statusPatch({ status: "todo" }, "doing", now), {
    status: "doing",
  });
  assert.deepEqual(statusPatch({ status: "doing" }, "done", now), {
    status: "done",
    completedAt: now,
  });
  assert.deepEqual(statusPatch({ status: "done" }, "todo", now), {
    status: "todo",
    completedAt: undefined,
  });
  assert.deepEqual(statusPatch({ status: "doing" }, null, now), {
    status: undefined,
    dueDate: undefined,
    taskOpenedAt: undefined,
    completedAt: undefined,
  });
  assert.deepEqual(statusPatch({ status: "todo" }, "todo", now), {});
  assert.deepEqual(statusPatch({}, null, now), {});
});

test("statsDelta counts only open tasks", () => {
  assert.deepEqual(statsDelta(undefined, "todo"), { todo: 1, doing: 0 });
  assert.deepEqual(statsDelta("todo", "doing"), { todo: -1, doing: 1 });
  assert.deepEqual(statsDelta("doing", "done"), { todo: 0, doing: -1 });
  assert.deepEqual(statsDelta("done", undefined), { todo: 0, doing: 0 });
  assert.deepEqual(statsDelta("todo", "todo"), { todo: 0, doing: 0 });
});

test("snippet centres on the match and stays within 160 chars", () => {
  assert.equal(snippet("hello world", "world"), "hello world");
  const body = `${"alpha ".repeat(200)}needle${" omega".repeat(200)}`;
  const hit = snippet(body, "needle");
  assert.ok(hit.includes("needle"));
  assert.ok(hit.startsWith("…"));
  assert.ok(hit.endsWith("…"));
  assert.ok(hit.length <= TEXT_PREVIEW_LENGTH);
  const miss = snippet(body, "zzz");
  assert.ok(!miss.startsWith("…"));
  assert.ok(miss.length <= TEXT_PREVIEW_LENGTH);
});

test("note size cap rejects bodies over 300 KB without truncating", () => {
  assert.equal(MAX_NOTE_BYTES, 300 * 1024);
  assert.doesNotThrow(() => assertNoteSize("a".repeat(MAX_NOTE_BYTES)));
  assert.throws(() => assertNoteSize("a".repeat(MAX_NOTE_BYTES + 1)), /300 KB/);
  assert.throws(() => assertNoteSize("é".repeat(MAX_NOTE_BYTES / 2 + 1)));
});

test("appendText adds text on a new line", () => {
  assert.equal(appendText("", "a"), "a");
  assert.equal(appendText("a", "b"), "a\nb");
  assert.equal(appendText("a\n", "b"), "a\nb");
});

test("isDueDate accepts only real calendar dates", () => {
  assert.equal(isDueDate("2026-10-01"), true);
  assert.equal(isDueDate("2026-02-30"), false);
  assert.equal(isDueDate("2026-1-01"), false);
});

test("boardPositionBetween places cards at the top, bottom and midpoint", () => {
  assert.equal(boardPositionBetween(null, null), 0);
  assert.equal(boardPositionBetween(null, 0), -BOARD_GAP);
  assert.equal(boardPositionBetween(2048, null), 2048 + BOARD_GAP);
  assert.equal(boardPositionBetween(0, 1024), 512);
  assert.equal(boardPositionBetween(-1024, 0), -512);
  assert.equal(boardPositionBetween(1, 1 + 1e-9), null);
  assert.equal(boardPositionBetween(5, 5), null);
  assert.equal(boardPositionBetween(6, 5), null);
});

test("topBoardPosition sits one gap above the current top", () => {
  assert.equal(topBoardPosition(undefined), 0);
  assert.equal(topBoardPosition(0), -BOARD_GAP);
  assert.equal(topBoardPosition(-3000), -3000 - BOARD_GAP);
});

test("normalizeRef validates kinds, urls and lengths", () => {
  assert.deepEqual(
    normalizeRef({ kind: "pr", url: " https://github.com/o/r/pull/12 " }),
    { kind: "pr", url: "https://github.com/o/r/pull/12" },
  );
  assert.deepEqual(
    normalizeRef({ kind: "comment", text: " ship it ", author: " lead " }),
    { kind: "comment", text: "ship it", author: "lead" },
  );
  assert.throws(() => normalizeRef({ kind: "pr" }), /needs a url/);
  assert.throws(() => normalizeRef({ kind: "issue", text: "x" }), /url/);
  assert.throws(() => normalizeRef({ kind: "comment", author: "a" }), /text/);
  assert.throws(
    () => normalizeRef({ kind: "link", url: "javascript:alert(1)" }),
    /http/,
  );
  assert.throws(() => normalizeRef({ kind: "link", url: "not a url" }), /URL/);
  assert.throws(
    () => normalizeRef({ kind: "link", url: `https://x.y/${"a".repeat(500)}` }),
    /500/,
  );
  assert.throws(
    () => normalizeRef({ kind: "comment", text: "a".repeat(2001) }),
    /2000/,
  );
  assert.throws(
    () => normalizeRef({ kind: "comment", text: "a", author: "b".repeat(101) }),
    /100/,
  );
});

test("sameRef compares kind, url and text", () => {
  const pr = { kind: "pr" as const, url: "https://x.y/1" };
  assert.equal(sameRef(pr, { ...pr, author: "z" }), true);
  assert.equal(sameRef(pr, { kind: "issue", url: "https://x.y/1" }), false);
  assert.equal(sameRef(pr, { kind: "pr", url: "https://x.y/2" }), false);
});

test("excerpts and snippets read only a window of large bodies", () => {
  const head = "Intro line with words.";
  const huge = `${head}\n${"filler text ".repeat(30_000)}`;
  assert.equal(buildExcerpt(huge).startsWith("Intro line with words."), true);
  assert.equal(buildExcerpt(huge).length, TEXT_PREVIEW_LENGTH);

  const deep = `${"alpha ".repeat(40_000)}needle here${" omega".repeat(40_000)}`;
  const hit = snippet(deep, "NEEDLE");
  assert.ok(hit.includes("needle here"));
  assert.ok(hit.startsWith("…"));
  assert.ok(hit.endsWith("…"));
  assert.ok(hit.length <= TEXT_PREVIEW_LENGTH);
  assert.ok(snippet("a (b) [c]", "(b)").includes("(b)"));
});

test("searchText keeps the first 32 KB without splitting characters", () => {
  assert.equal(searchText("short"), "short");
  const ascii = "a".repeat(SEARCH_TEXT_BYTES + 10);
  assert.equal(searchText(ascii).length, SEARCH_TEXT_BYTES);
  const wide = "é".repeat(SEARCH_TEXT_BYTES);
  const cut = searchText(wide);
  assert.ok(new TextEncoder().encode(cut).byteLength <= SEARCH_TEXT_BYTES);
  assert.ok(!cut.includes("\uFFFD"));
  assert.equal(cut, "é".repeat(SEARCH_TEXT_BYTES / 2));
});
