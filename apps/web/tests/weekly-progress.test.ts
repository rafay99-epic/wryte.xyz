/**
 * Self-check for src/features/dashboard/lib/weekly-progress.ts.
 * Run: bun scripts/weekly-progress.test.ts
 */
import assert from "node:assert/strict";
import { wordsThisWeek } from "../src/features/dashboard/lib/weekly-progress";

const now = new Date(2026, 6, 17); // 2026-07-17, local

// Empty activity → just today's live counter
assert.equal(wordsThisWeek([], 250, now), 250);

// Prior six days count, the 7th day back does not
assert.equal(
  wordsThisWeek(
    [
      { date: "2026-07-16", words: 100 },
      { date: "2026-07-11", words: 100 }, // 6 days back — in window
      { date: "2026-07-10", words: 999 }, // 7 days back — out
    ],
    50,
    now,
  ),
  250,
);

// Today's stale activity entry never double-counts against wordsToday
assert.equal(
  wordsThisWeek([{ date: "2026-07-17", words: 400 }], 500, now),
  500,
);

// Future/garbage dates are ignored
assert.equal(
  wordsThisWeek(
    [
      { date: "2026-07-20", words: 999 },
      { date: "not-a-date", words: 999 },
      { date: "2026-07-15", words: 75 },
    ],
    0,
    now,
  ),
  75,
);

// Month boundary: window reaches back into June correctly
const july2 = new Date(2026, 6, 2);
assert.equal(
  wordsThisWeek(
    [
      { date: "2026-06-26", words: 60 }, // 6 days back — in
      { date: "2026-06-25", words: 999 }, // 7 days back — out
    ],
    40,
    july2,
  ),
  100,
);

console.info("weekly-progress: all assertions passed");
