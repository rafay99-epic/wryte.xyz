/**
 * Self-check for extractSnippet in convex/cms/_lib/documentContent.ts —
 * the excerpt builder behind the command palette's content-search rows.
 * Run: bun test tests
 */
import assert from "node:assert/strict";
import { extractSnippet } from "../convex/cms/_lib/documentContent";

// Short body: returned whole, no ellipses either side.
assert.equal(extractSnippet("hello world", "world"), "hello world");

// No literal match (prefix-matched last term) falls back to the opening.
assert.equal(extractSnippet("hello world", "zzz"), "hello world");

// Empty body stays empty rather than producing bare ellipses.
assert.equal(extractSnippet("", "anything"), "");

// Match deep inside a long body: centred, truncated, marked on both sides.
const longBody = `${"alpha ".repeat(200)}needle${" omega".repeat(200)}`;
const centred = extractSnippet(longBody, "needle");
assert.ok(centred.includes("needle"), "snippet must contain the match");
assert.ok(centred.startsWith("…"), "leading truncation is marked");
assert.ok(centred.endsWith("…"), "trailing truncation is marked");
// 90 chars of radius each side, plus the two ellipses and whitespace collapse.
assert.ok(centred.length < 220, `snippet too long: ${centred.length}`);

// A match at the very start is not prefixed with an ellipsis.
const atStart = extractSnippet(`needle${" omega".repeat(200)}`, "needle");
assert.ok(!atStart.startsWith("…"), "no leading ellipsis at offset 0");
assert.ok(atStart.endsWith("…"), "trailing truncation still marked");

// Multi-word terms centre on the EARLIEST matching token, not the first typed.
const multi = extractSnippet(
  `${"pad ".repeat(100)}second${" pad".repeat(100)}first${" pad".repeat(100)}`,
  "first second",
);
assert.ok(
  multi.includes("second"),
  "centres on the earliest token in the body",
);
assert.ok(!multi.includes("first"), "far-away token stays outside the radius");

// Newlines and runs of whitespace collapse to single spaces (single-line row).
assert.equal(
  extractSnippet("line one\n\n  line   two", "line one"),
  "line one line two",
);

console.info("document-snippet: all assertions passed");
