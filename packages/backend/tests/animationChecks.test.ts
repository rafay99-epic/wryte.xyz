/**
 * Golden checks for the animation publish gate. Run directly:
 * `bun run tests/animationChecks.test.ts`. Every assert throws on failure.
 */
import assert from "node:assert/strict";
import type { AnimationCheckRecord } from "../convex/_lib/animationChecks";
import {
  findPublishBlockers,
  hashAnimationSource,
  isCheckCurrent,
  summarizeDiagnostics,
} from "../convex/_lib/animationChecks";

const SOURCE = "export default function A(){return null}";
const EDITED = "export default function A(){return <div/>}";

assert.equal(hashAnimationSource(SOURCE), hashAnimationSource(SOURCE));
assert.notEqual(hashAnimationSource(SOURCE), hashAnimationSource(EDITED));
assert.equal(hashAnimationSource(""), hashAnimationSource(""));

const passing: AnimationCheckRecord = {
  sourceHash: hashAnimationSource(SOURCE),
  status: "pass",
  errorCount: 0,
  warningCount: 0,
  checkedAt: 1,
};

assert.equal(isCheckCurrent(passing, SOURCE), true);
assert.equal(isCheckCurrent(passing, EDITED), false);
assert.equal(isCheckCurrent(undefined, SOURCE), false);

assert.deepEqual(summarizeDiagnostics([]), {
  status: "pass",
  errorCount: 0,
  warningCount: 0,
});

assert.deepEqual(
  summarizeDiagnostics([
    { rule: "a", severity: "warning", message: "", line: 1, column: 1 },
    { rule: "b", severity: "error", message: "", line: 2, column: 1 },
    { rule: "c", severity: "error", message: "", line: 3, column: 1 },
  ]),
  { status: "fail", errorCount: 2, warningCount: 1 },
);

assert.deepEqual(
  summarizeDiagnostics([
    { rule: "a", severity: "warning", message: "", line: 1, column: 1 },
  ]),
  { status: "warn", errorCount: 0, warningCount: 1 },
);

assert.deepEqual(
  findPublishBlockers("off", [
    { name: "Broken", source: SOURCE, check: undefined },
  ]),
  [],
);

assert.deepEqual(
  findPublishBlockers("contract", [
    { name: "Checked", source: SOURCE, check: passing },
  ]),
  [],
);

assert.deepEqual(
  findPublishBlockers("contract", [
    { name: "Unchecked", source: SOURCE, check: undefined },
  ]),
  [{ name: "Unchecked", reason: "stale", errorCount: 0 }],
);

assert.deepEqual(
  findPublishBlockers("strict", [
    { name: "EditedSinceCheck", source: EDITED, check: passing },
  ]),
  [{ name: "EditedSinceCheck", reason: "stale", errorCount: 0 }],
);

assert.deepEqual(
  findPublishBlockers("strict", [
    {
      name: "Failing",
      source: SOURCE,
      check: { ...passing, status: "fail", errorCount: 3 },
    },
    {
      name: "Warned",
      source: SOURCE,
      check: { ...passing, status: "warn", warningCount: 2 },
    },
  ]),
  [{ name: "Failing", reason: "failing", errorCount: 3 }],
);

console.info("animationChecks: all assertions passed");
