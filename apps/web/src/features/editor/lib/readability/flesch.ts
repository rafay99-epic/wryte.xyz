/**
 * Syllable estimation + Flesch reading-ease / Flesch–Kincaid grade.
 *
 * Syllable counting is heuristic (vowel-group counting with a silent-`e`
 * adjustment) — cheap and good enough for an advisory readability score. Pure.
 */

export function countSyllables(rawWord: string): number {
  const word = rawWord.toLowerCase().replace(/[^a-z]/g, "");
  if (word.length === 0) return 0;
  if (word.length <= 3) return 1;

  const trimmed = word
    // drop common silent endings
    .replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, "")
    .replace(/^y/, "");
  const groups = trimmed.match(/[aeiouy]{1,2}/g);
  return groups ? groups.length : 1;
}

export function fleschReadingEase(
  words: number,
  sentences: number,
  syllables: number,
): number {
  if (words === 0 || sentences === 0) return 0;
  const score =
    206.835 - 1.015 * (words / sentences) - 84.6 * (syllables / words);
  // Clamp to the conventional 0–100 display range.
  return Math.max(0, Math.min(100, score));
}

export function fleschKincaidGrade(
  words: number,
  sentences: number,
  syllables: number,
): number {
  if (words === 0 || sentences === 0) return 0;
  const grade = 0.39 * (words / sentences) + 11.8 * (syllables / words) - 15.59;
  return Math.max(0, grade);
}
