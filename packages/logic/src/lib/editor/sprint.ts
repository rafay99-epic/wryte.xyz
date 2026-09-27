/**
 * Pure helpers for writing sprints and session stats. Kept free of React and
 * store imports so both the sprint HUD and the sprint popover share one
 * formatting/derivation path.
 */

/** Format a millisecond duration as a `M:SS` clock (never negative). */
export function formatClock(ms: number): string {
  const totalSeconds = Math.max(0, Math.round(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

/**
 * Live words-per-minute. Clamps the elapsed time to a 10s floor so the first
 * few keystrokes of a sprint don't report absurd four-digit rates.
 */
export function wordsPerMinute(words: number, elapsedMs: number): number {
  if (words <= 0) return 0;
  const minutes = Math.max(elapsedMs, 10_000) / 60_000;
  return Math.round(words / minutes);
}
