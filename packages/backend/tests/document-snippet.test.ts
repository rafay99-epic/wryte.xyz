import assert from "node:assert/strict";
import { extractSnippet } from "../convex/cms/_lib/documentContent";

assert.equal(extractSnippet("hello world", "world"), "hello world");

assert.equal(extractSnippet("hello world", "zzz"), "hello world");

assert.equal(extractSnippet("", "anything"), "");

const longBody = `${"alpha ".repeat(200)}needle${" omega".repeat(200)}`;
const centred = extractSnippet(longBody, "needle");
assert.ok(centred.includes("needle"), "snippet must contain the match");
assert.ok(centred.startsWith("…"), "leading truncation is marked");
assert.ok(centred.endsWith("…"), "trailing truncation is marked");
assert.ok(centred.length < 220, `snippet too long: ${centred.length}`);

const atStart = extractSnippet(`needle${" omega".repeat(200)}`, "needle");
assert.ok(!atStart.startsWith("…"), "no leading ellipsis at offset 0");
assert.ok(atStart.endsWith("…"), "trailing truncation still marked");

const multi = extractSnippet(
  `${"pad ".repeat(100)}second${" pad".repeat(100)}first${" pad".repeat(100)}`,
  "first second",
);
assert.ok(
  multi.includes("second"),
  "centres on the earliest token in the body",
);
assert.ok(!multi.includes("first"), "far-away token stays outside the radius");

assert.equal(
  extractSnippet("line one\n\n  line   two", "line one"),
  "line one line two",
);

console.info("document-snippet: all assertions passed");
