import assert from "node:assert/strict";
import {
  currentRevision,
  isExternalRevision,
} from "@wryte/logic/lib/editor/body-sync";

const me = "session-a";

assert.equal(isExternalRevision({ rev: 3 }, 3, me), false);
assert.equal(isExternalRevision({ rev: 4 }, 3, me), true);
assert.equal(isExternalRevision({ rev: 2 }, 3, me), false);
assert.equal(isExternalRevision({ rev: 4, writer: me }, 3, me), false);
assert.equal(isExternalRevision({ rev: 4, writer: "session-b" }, 3, me), true);

assert.equal(currentRevision(undefined, 3, me), 3);
assert.equal(currentRevision(null, 3, me), 3);
assert.equal(currentRevision({ rev: 5, writer: me }, 3, me), 5);
assert.equal(currentRevision({ rev: 5, writer: "session-b" }, 3, me), 3);
assert.equal(currentRevision({ rev: 5 }, 3, me), 3);
assert.equal(currentRevision({ rev: 2, writer: me }, 3, me), 3);

console.info("editor-body-sync: all assertions passed");
