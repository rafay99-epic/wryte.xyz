"use strict";

// Smallest thing that fails if the stream parsing breaks. Run: bun run test
// (from apps/desktop) or `node apps/desktop/tests/harness.test.cjs`.

const assert = require("node:assert/strict");
const { createLineBuffer } = require("../src/harness/line-buffer.cjs");
const { normalize } = require("../src/harness/claude.cjs");

// ── line buffer: a JSON object split across chunk boundaries ──────────────
{
  const lines = [];
  const buffer = createLineBuffer((line) => lines.push(line));

  // One object, delivered in three pieces that align with nothing.
  buffer.push('{"a":1}\n{"b":');
  buffer.push("2}\n{");
  buffer.push('"c":3}');
  buffer.flush();

  assert.deepEqual(lines, ['{"a":1}', '{"b":2}', '{"c":3}']);
  assert.deepEqual(
    lines.map((line) => JSON.parse(line)),
    [{ a: 1 }, { b: 2 }, { c: 3 }],
    "every line must survive as valid JSON",
  );
}

// CRLF and blank lines
{
  const lines = [];
  const buffer = createLineBuffer((line) => lines.push(line));
  buffer.push('{"a":1}\r\n\r\n{"b":2}\r\n');
  buffer.flush();
  assert.deepEqual(lines, ['{"a":1}', '{"b":2}']);
}

// ── normalize: real Claude Code stream-json shapes ────────────────────────
assert.deepEqual(
  normalize({ type: "system", subtype: "init", session_id: "abc" }),
  { type: "session.ready", sessionId: "abc" },
);

// Hook chatter is noise — the spawned CLI inherits the user's own hooks and
// echoes their entire output on stdout.
assert.equal(
  normalize({ type: "system", subtype: "hook_started", hook_id: "x" }),
  null,
);
assert.equal(
  normalize({ type: "system", subtype: "hook_response", output: "…" }),
  null,
);

assert.deepEqual(
  normalize({
    type: "stream_event",
    event: {
      type: "content_block_delta",
      delta: { type: "text_delta", text: "ok" },
    },
  }),
  { type: "text.delta", kind: "assistant", text: "ok" },
);

assert.deepEqual(
  normalize({
    type: "stream_event",
    event: {
      type: "content_block_delta",
      delta: { type: "thinking_delta", thinking: "hmm" },
    },
  }),
  { type: "text.delta", kind: "reasoning", text: "hmm" },
);

assert.deepEqual(
  normalize({
    type: "stream_event",
    event: {
      type: "content_block_start",
      content_block: { type: "tool_use", name: "Read", id: "t1" },
    },
  }),
  { type: "tool.started", name: "Read", id: "t1" },
);

assert.deepEqual(
  normalize({
    type: "result",
    is_error: false,
    result: "done",
    duration_ms: 42,
  }),
  { type: "turn.completed", error: false, text: "done", durationMs: 42 },
);

// Unknown shapes must be dropped, never crash the stream.
assert.equal(normalize({ type: "rate_limit_event" }), null);
assert.equal(normalize({ type: "stream_event", event: undefined }), null);

console.log("harness: all assertions passed");
