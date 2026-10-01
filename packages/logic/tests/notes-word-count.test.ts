import assert from "node:assert/strict";
import { countWords as serverCountWords } from "@wryte/backend/_lib/wordCount";
import { countWords } from "@wryte/logic/lib/word-count";

const samples = [
  "",
  "   ",
  "one",
  "  two words  ",
  "line\nbreak\ttab",
  "nbsp split em　ideographic",
  "# Heading\n\n- item one\n- item two\n\n```ts\nconst x = 1;\n```",
  "trailing\n\n\n",
];

for (const sample of samples) {
  assert.equal(countWords(sample), serverCountWords(sample), sample);
}

console.info("notes-word-count: all assertions passed");
