import { test } from "bun:test";
import assert from "node:assert/strict";
import { shouldTouch, TOUCH_INTERVAL_MS } from "../convex/_lib/touch";
import {
  appendText,
  assertNoteSize,
  buildExcerpt,
  isDueDate,
  MAX_NOTE_BYTES,
  snippet,
  statsDelta,
  statusPatch,
  TEXT_PREVIEW_LENGTH,
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
