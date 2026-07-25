/** Shared types for the readability analysis (pure, framework-free). */

export type FlagType =
  | "long-sentence"
  | "very-long-sentence"
  | "passive"
  | "adverb"
  | "complex";

/** A flagged character span, as offsets into the exact analyzed string. */
export type Range = {
  start: number;
  end: number;
  type: FlagType;
};

/** A sentence flagged as (very) long — the clickable items in the panel. */
export type HardSentence = {
  start: number;
  end: number;
  words: number;
  type: "long-sentence" | "very-long-sentence";
};

export type ReadabilityStats = {
  words: number;
  sentences: number;
  paragraphs: number;
  characters: number;
  /** Average words per sentence. */
  avgWordsPerSentence: number;
  /** Estimated reading time in minutes (>= 1 when any words). */
  readingMinutes: number;
  /** Flesch reading-ease (0–100; higher = easier). */
  fleschReadingEase: number;
  /** Flesch–Kincaid US grade level. */
  gradeLevel: number;
  counts: Record<FlagType, number>;
};

export type ReadabilityResult = {
  ranges: Range[];
  hardSentences: HardSentence[];
  stats: ReadabilityStats;
};
