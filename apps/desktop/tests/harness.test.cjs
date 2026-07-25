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

// ── MCP dispatch: protocol shape + tool proxying ──────────────────────────
{
  const { McpServer, TOOLS } = require("../src/harness/mcp-server.cjs");
  const seen = [];
  const server = new McpServer(async (name, args) => {
    seen.push([name, args]);
    if (name === "get_document") throw new Error("boom");
    return { ok: true };
  });

  const run = async () => {
    const init = await server.dispatch({ method: "initialize" });
    assert.equal(init.result.serverInfo.name, "wryte");
    assert.ok(init.result.capabilities.tools, "must advertise tools");

    const list = await server.dispatch({ method: "tools/list" });
    assert.deepEqual(
      list.result.tools.map((tool) => tool.name),
      TOOLS.map((tool) => tool.name),
    );

    const ok = await server.dispatch({
      method: "tools/call",
      params: { name: "add_research", arguments: { title: "T" } },
    });
    assert.equal(ok.result.isError, undefined);
    assert.deepEqual(seen[0], ["add_research", { title: "T" }]);

    // A failing tool must come back as a tool result the model can read,
    // not a JSON-RPC error that kills the turn.
    const failed = await server.dispatch({
      method: "tools/call",
      params: { name: "get_document", arguments: {} },
    });
    assert.equal(failed.result.isError, true);
    assert.match(failed.result.content[0].text, /boom/);

    // Tools outside the declared set never reach the renderer.
    const before = seen.length;
    const unknown = await server.dispatch({
      method: "tools/call",
      params: { name: "delete_everything", arguments: {} },
    });
    assert.equal(unknown.error.code, -32602);
    assert.equal(seen.length, before, "unknown tool must not be proxied");

    const bad = await server.dispatch({ method: "nope" });
    assert.equal(bad.error.code, -32601);
  };

  run().then(
    () => console.info("harness: all assertions passed"),
    (error) => {
      console.error(error);
      process.exit(1);
    },
  );
}
