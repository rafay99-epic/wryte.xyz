/**
 * Word-level heuristics (pure): adverbs, complex words, passive-voice markers.
 * These are intentionally simple/advisory — matching the spirit of Hemingway's
 * own lightweight detectors. False positives are acceptable.
 */

import { countSyllables } from "./flesch";

/** `-ly` words that aren't adverbs. */
const ADVERB_STOPLIST = new Set([
  "only",
  "family",
  "reply",
  "apply",
  "supply",
  "imply",
  "comply",
  "rely",
  "ally",
  "july",
  "italy",
  "holy",
  "ugly",
  "early",
  "fully",
  "jelly",
  "belly",
  "rally",
  "bully",
  "lily",
  "ply",
  "anomaly",
  "assembly",
  "monopoly",
  "panoply",
  "likely",
]);

export function isAdverb(word: string): boolean {
  const w = word.toLowerCase();
  if (w.length <= 4 || !w.endsWith("ly")) return false;
  return !ADVERB_STOPLIST.has(w);
}

/** Words with a simpler, shorter alternative — flagged regardless of length. */
const COMPLEX_WORDS = new Set([
  "utilize",
  "utilise",
  "leverage",
  "facilitate",
  "numerous",
  "approximately",
  "subsequently",
  "nevertheless",
  "notwithstanding",
  "aforementioned",
  "commence",
  "endeavor",
  "endeavour",
  "demonstrate",
  "additional",
  "initiate",
  "terminate",
  "ascertain",
  "expedite",
  "methodology",
  "functionality",
  "prioritize",
  "prioritise",
]);

export function isComplexWord(word: string): boolean {
  const w = word.toLowerCase();
  if (COMPLEX_WORDS.has(w)) return true;
  return countSyllables(w) >= 4;
}

const BE_VERBS = new Set([
  "am",
  "is",
  "are",
  "was",
  "were",
  "be",
  "been",
  "being",
]);

export function isBeVerb(word: string): boolean {
  return BE_VERBS.has(word.toLowerCase());
}

const IRREGULAR_PARTICIPLES = new Set([
  "done",
  "made",
  "gone",
  "seen",
  "given",
  "taken",
  "known",
  "shown",
  "written",
  "built",
  "sent",
  "held",
  "kept",
  "left",
  "found",
  "told",
  "brought",
  "bought",
  "thought",
  "caught",
  "taught",
  "paid",
  "said",
  "lost",
  "won",
  "drawn",
  "grown",
  "thrown",
  "blown",
  "driven",
  "chosen",
  "broken",
  "spoken",
  "stolen",
  "frozen",
  "hidden",
  "beaten",
  "eaten",
  "fallen",
  "forgotten",
  "worn",
  "torn",
  "born",
  "begun",
  "become",
  "set",
  "put",
  "cut",
  "read",
  "led",
  "felt",
  "met",
]);

export function isPastParticiple(word: string): boolean {
  const w = word.toLowerCase();
  if (IRREGULAR_PARTICIPLES.has(w)) return true;
  return w.length > 4 && w.endsWith("ed");
}
