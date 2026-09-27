import assert from "node:assert/strict";
import { wordsThisWeek } from "@wryte/logic/lib/weekly-progress";

const now = new Date(2026, 6, 17);

assert.equal(wordsThisWeek([], 250, now), 250);

assert.equal(
  wordsThisWeek(
    [
      { date: "2026-07-16", words: 100 },
      { date: "2026-07-11", words: 100 },
      { date: "2026-07-10", words: 999 },
    ],
    50,
    now,
  ),
  250,
);

assert.equal(
  wordsThisWeek([{ date: "2026-07-17", words: 400 }], 500, now),
  500,
);

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

const july2 = new Date(2026, 6, 2);
assert.equal(
  wordsThisWeek(
    [
      { date: "2026-06-26", words: 60 },
      { date: "2026-06-25", words: 999 },
    ],
    40,
    july2,
  ),
  100,
);

console.info("weekly-progress: all assertions passed");
