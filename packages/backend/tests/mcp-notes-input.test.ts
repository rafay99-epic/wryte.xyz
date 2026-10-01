import assert from "node:assert/strict";
import {
  agentDate,
  agentDocumentIds,
  agentMaxChars,
  agentQueryText,
  DEFAULT_NOTE_CHARS,
} from "../convex/mcp/agentInput";

function documentIds(count: number): string[] {
  return Array.from({ length: count }, (_, i) => `doc${String(i)}`);
}

assert.equal(agentDocumentIds(documentIds(20)).length, 20);
assert.throws(() => agentDocumentIds(documentIds(21)), /at most 20/);
assert.equal(agentDocumentIds(Array(30).fill("doc0")).length, 1);

assert.equal(agentMaxChars(undefined), DEFAULT_NOTE_CHARS);
assert.equal(agentMaxChars(100), 100);
assert.throws(() => agentMaxChars(0), /maxChars/);
assert.throws(() => agentMaxChars(1.5), /maxChars/);
assert.throws(() => agentMaxChars(10_000_000), /maxChars/);

assert.equal(agentDate(" 2030-01-15 "), "2030-01-15");
assert.throws(() => agentDate("2030-02-30"), /YYYY-MM-DD/);
assert.throws(() => agentDate("tomorrow"), /YYYY-MM-DD/);

assert.equal(agentQueryText("  hello "), "hello");
assert.throws(() => agentQueryText("  "), /required/);
assert.throws(() => agentQueryText("x".repeat(201)), /200/);

console.info("mcp-notes-input: all assertions passed");
