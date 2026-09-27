export { countWords } from "@wryte/backend/_lib/wordCount";

export function formatWordCount(count: number): string {
  if (count >= 1000) return `${(count / 1000).toFixed(1)}k`;
  return String(count);
}
