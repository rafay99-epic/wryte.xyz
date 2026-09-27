export function formatClock(ms: number): string {
  const totalSeconds = Math.max(0, Math.round(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export function wordsPerMinute(words: number, elapsedMs: number): number {
  if (words <= 0) return 0;
  const minutes = Math.max(elapsedMs, 10_000) / 60_000;
  return Math.round(words / minutes);
}
