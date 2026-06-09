/**
 * Combines segmentation + heuristics into the full readability result (pure,
 * framework-free, safe to run in a Web Worker). All offsets are character
 * indices into the exact input string, so the panel can select-and-jump.
 */

import {
  countSyllables,
  fleschKincaidGrade,
  fleschReadingEase,
} from "./flesch";
import {
  isAdverb,
  isBeVerb,
  isComplexWord,
  isPastParticiple,
} from "./heuristics";
import {
  countParagraphs,
  findCodeRanges,
  maskCode,
  splitSentences,
  tokenizeWords,
} from "./segment";
import type { FlagType, HardSentence, Range, ReadabilityResult } from "./types";

const LONG_SENTENCE = 14;
const VERY_LONG_SENTENCE = 25;
const WORDS_PER_MINUTE = 238;

export function analyze(text: string): ReadabilityResult {
  const codeRanges = findCodeRanges(text);
  const masked = maskCode(text, codeRanges);
  const words = tokenizeWords(masked);
  const sentences = splitSentences(masked);
  const paragraphs = countParagraphs(masked);

  const ranges: Range[] = [];
  const hardSentences: HardSentence[] = [];
  const counts: Record<FlagType, number> = {
    "long-sentence": 0,
    "very-long-sentence": 0,
    passive: 0,
    adverb: 0,
    complex: 0,
  };

  // ── word-level flags ──
  let totalSyllables = 0;
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    if (!w) continue;
    totalSyllables += countSyllables(w.text);

    if (isAdverb(w.text)) {
      ranges.push({ start: w.start, end: w.end, type: "adverb" });
      counts.adverb++;
    }
    if (isComplexWord(w.text)) {
      ranges.push({ start: w.start, end: w.end, type: "complex" });
      counts.complex++;
    }
    // passive: a be-verb followed within 3 words by a past participle.
    if (isBeVerb(w.text)) {
      for (let j = i + 1; j <= i + 3 && j < words.length; j++) {
        const cand = words[j];
        if (cand && isPastParticiple(cand.text)) {
          ranges.push({ start: w.start, end: cand.end, type: "passive" });
          counts.passive++;
          break;
        }
      }
    }
  }

  // ── sentence-level flags (word count per sentence via a monotonic sweep) ──
  let wi = 0;
  for (const s of sentences) {
    while (wi < words.length && (words[wi]?.start ?? Infinity) < s.start) wi++;
    let count = 0;
    let k = wi;
    while (k < words.length && (words[k]?.start ?? Infinity) < s.end) {
      count++;
      k++;
    }
    if (count >= VERY_LONG_SENTENCE) {
      ranges.push({ start: s.start, end: s.end, type: "very-long-sentence" });
      counts["very-long-sentence"]++;
      hardSentences.push({
        start: s.start,
        end: s.end,
        words: count,
        type: "very-long-sentence",
      });
    } else if (count >= LONG_SENTENCE) {
      ranges.push({ start: s.start, end: s.end, type: "long-sentence" });
      counts["long-sentence"]++;
      hardSentences.push({
        start: s.start,
        end: s.end,
        words: count,
        type: "long-sentence",
      });
    }
  }
  hardSentences.sort((a, b) => b.words - a.words);

  const wordCount = words.length;
  const sentenceCount = sentences.length;

  return {
    ranges,
    hardSentences,
    stats: {
      words: wordCount,
      sentences: sentenceCount,
      paragraphs,
      characters: text.length,
      avgWordsPerSentence: sentenceCount ? wordCount / sentenceCount : 0,
      readingMinutes: wordCount
        ? Math.max(1, Math.round(wordCount / WORDS_PER_MINUTE))
        : 0,
      fleschReadingEase: fleschReadingEase(
        wordCount,
        sentenceCount,
        totalSyllables,
      ),
      gradeLevel: fleschKincaidGrade(wordCount, sentenceCount, totalSyllables),
      counts,
    },
  };
}
