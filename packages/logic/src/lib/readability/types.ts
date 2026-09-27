export type FlagType =
  | "long-sentence"
  | "very-long-sentence"
  | "passive"
  | "adverb"
  | "complex";

export type Range = {
  start: number;
  end: number;
  type: FlagType;
};

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
  avgWordsPerSentence: number;
  readingMinutes: number;
  fleschReadingEase: number;
  gradeLevel: number;
  counts: Record<FlagType, number>;
};

export type ReadabilityResult = {
  ranges: Range[];
  hardSentences: HardSentence[];
  stats: ReadabilityStats;
};
