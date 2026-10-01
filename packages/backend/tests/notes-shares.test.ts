import { test } from "bun:test";
import assert from "node:assert/strict";
import {
  bodyFits,
  isShareToken,
  MAX_SHARE_TITLE_LENGTH,
  newShareToken,
  normalizeShareTitle,
  SHARE_BODY_BYTES,
  sharedBodySize,
  shareExpiresAt,
  shareLabel,
} from "../convex/cms/notes/_lib/shareModel";
import { retryMessage, retrySeconds } from "../convex/mcp/retry";

test("share tokens are 43-char base64url and unique", () => {
  const tokens = Array.from({ length: 200 }, newShareToken);
  for (const token of tokens) {
    assert.equal(token.length, 43);
    assert.ok(isShareToken(token), token);
  }
  assert.equal(new Set(tokens).size, tokens.length);
});

test("token validation rejects anything else before a db read", () => {
  assert.ok(!isShareToken(""));
  assert.ok(!isShareToken("a".repeat(42)));
  assert.ok(!isShareToken("a".repeat(44)));
  assert.ok(!isShareToken(`${"a".repeat(42)}=`));
  assert.ok(!isShareToken(`${"a".repeat(42)}/`));
  assert.ok(!isShareToken(`${"a".repeat(42)}+`));
  assert.ok(isShareToken(`${"a".repeat(41)}-_`));
});

test("expiry is whole days from now, or never", () => {
  const now = 1_800_000_000_000;
  assert.equal(shareExpiresAt(now, undefined), undefined);
  assert.equal(shareExpiresAt(now, 1), now + 86_400_000);
  assert.equal(shareExpiresAt(now, 7), now + 7 * 86_400_000);
  assert.equal(shareExpiresAt(now, 30), now + 30 * 86_400_000);
});

test("share labels name what is shared", () => {
  assert.equal(
    shareLabel({ kind: "note", noteCount: 1, noteTitle: " Plan " }),
    "Plan",
  );
  assert.equal(
    shareLabel({ kind: "note", noteCount: 1, noteTitle: "  " }),
    "Untitled note",
  );
  assert.equal(shareLabel({ kind: "notes", noteCount: 3 }), "3 notes");
  assert.equal(shareLabel({ kind: "notes", noteCount: 1 }), "1 note");
  assert.equal(
    shareLabel({ kind: "group", noteCount: 9, groupName: "Work log" }),
    "Work log",
  );
  assert.equal(shareLabel({ kind: "group", noteCount: 0 }), "Deleted group");
});

test("share titles are trimmed and capped", () => {
  assert.equal(normalizeShareTitle(undefined), undefined);
  assert.equal(normalizeShareTitle("   "), undefined);
  assert.equal(normalizeShareTitle("  Sprint  "), "Sprint");
  assert.equal(
    normalizeShareTitle("x".repeat(MAX_SHARE_TITLE_LENGTH)),
    "x".repeat(MAX_SHARE_TITLE_LENGTH),
  );
  assert.throws(
    () => normalizeShareTitle("x".repeat(MAX_SHARE_TITLE_LENGTH + 1)),
    /120 characters/,
  );
});

test("body batches stay under the byte cap but always return one", () => {
  const big = { content: "é".repeat(150 * 1024), refs: [] };
  assert.equal(sharedBodySize(big), 300 * 1024 + 2);
  assert.ok(bodyFits(0, sharedBodySize(big), SHARE_BODY_BYTES));
  assert.ok(!bodyFits(300 * 1024, sharedBodySize(big), SHARE_BODY_BYTES));
  assert.ok(bodyFits(0, SHARE_BODY_BYTES * 2, SHARE_BODY_BYTES));
  assert.ok(bodyFits(100, SHARE_BODY_BYTES - 100, SHARE_BODY_BYTES));
});

test("rate limit errors tell the agent how long to wait", () => {
  assert.equal(retrySeconds(undefined), 1);
  assert.equal(retrySeconds(0), 1);
  assert.equal(retrySeconds(1001), 2);
  assert.equal(retryMessage(4200), "Rate limited: retry in 5 s");
});
