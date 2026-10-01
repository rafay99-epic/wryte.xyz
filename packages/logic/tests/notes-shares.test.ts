import assert from "node:assert/strict";
import type { Id } from "@wryte/backend/_generated/dataModel";
import type { ShareRow } from "@wryte/backend/cms/notes/_lib/shareModel";
import {
  bodyBatch,
  isShareExpiryChoice,
  noteCountLabel,
  shareCreateArgs,
  shareExpiryLabel,
  sharesForTarget,
  shareTokenFromHash,
  shareUrl,
} from "@wryte/logic/lib/notes/shares";

const token = `${"A".repeat(42)}_`;

assert.equal(shareTokenFromHash(`#${token}`), token);
assert.equal(shareTokenFromHash(token), token);
assert.equal(shareTokenFromHash(""), null);
assert.equal(shareTokenFromHash("#short"), null);
assert.equal(shareTokenFromHash(`#${token}x`), null);
assert.equal(shareTokenFromHash(`#${"A".repeat(42)}=`), null);

assert.equal(
  shareUrl("https://wryte.xyz", token),
  `https://wryte.xyz/shared#${token}`,
);

const ids = ["a", "b", "c", "d", "e"];
assert.deepEqual(bodyBatch(ids, 0, new Set(), 2), ["a", "b"]);
assert.deepEqual(bodyBatch(ids, 1, new Set(["a", "b"]), 2), []);
assert.deepEqual(bodyBatch(ids, 1, new Set(["c"]), 3), ["b", "d"]);
assert.deepEqual(bodyBatch(ids, 4, new Set(), 3), ["e"]);
assert.deepEqual(bodyBatch(ids, 9, new Set(), 3), []);
assert.deepEqual(bodyBatch(ids, -1, new Set(), 1), []);
assert.equal(
  bodyBatch(
    Array.from({ length: 30 }, (_, i) => i),
    0,
    new Set(),
  ).length,
  10,
);

const now = 1_000_000_000;
const hour = 60 * 60 * 1000;
assert.equal(shareExpiryLabel(undefined, now), "No expiry");
assert.equal(shareExpiryLabel(now - 1, now), "Expired");
assert.equal(shareExpiryLabel(now + 2 * hour, now), "Expires in 2h");
assert.equal(shareExpiryLabel(now + 30 * hour, now), "Expires in 2d");

assert.equal(noteCountLabel(1), "1 note");
assert.equal(noteCountLabel(0), "0 notes");
assert.equal(noteCountLabel(12), "12 notes");

assert.equal(isShareExpiryChoice("7"), true);
assert.equal(isShareExpiryChoice("never"), true);
assert.equal(isShareExpiryChoice("14"), false);

const noteId = "n1" as Id<"notes">;
const otherId = "n2" as Id<"notes">;
const groupId = "g1" as Id<"note_groups">;

assert.deepEqual(
  shareCreateArgs({ kind: "note", noteId, label: "A" }, "  ", "never"),
  { kind: "note", noteIds: [noteId] },
);
assert.deepEqual(
  shareCreateArgs(
    { kind: "notes", noteIds: [noteId, otherId], label: "2 notes" },
    " Sprint ",
    "7",
  ),
  {
    kind: "notes",
    noteIds: [noteId, otherId],
    title: "Sprint",
    expiresInDays: 7,
  },
);
assert.deepEqual(
  shareCreateArgs({ kind: "group", groupId, label: "G" }, "", "1"),
  { kind: "group", groupId, expiresInDays: 1 },
);

const row = (fields: Partial<ShareRow>): ShareRow => ({
  shareId: "s" as Id<"note_shares">,
  token,
  kind: "note",
  label: "x",
  noteCount: 1,
  createdAt: now,
  ...fields,
});
const shares = [
  row({ kind: "note", noteIds: [noteId] }),
  row({ kind: "note", noteIds: [otherId] }),
  row({ kind: "notes", noteIds: [noteId, otherId], noteCount: 2 }),
  row({ kind: "group", groupId, noteCount: 4 }),
];
assert.equal(
  sharesForTarget(shares, { kind: "note", noteId, label: "A" }).length,
  1,
);
assert.equal(
  sharesForTarget(shares, { kind: "group", groupId, label: "G" }).length,
  1,
);
assert.equal(
  sharesForTarget(shares, {
    kind: "notes",
    noteIds: [noteId, otherId],
    label: "2 notes",
  }).length,
  0,
);

console.info("notes-shares: all assertions passed");
