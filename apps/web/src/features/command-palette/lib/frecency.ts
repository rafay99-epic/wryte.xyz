/**
 * Recently-opened tracking for the command palette — pure localStorage,
 * zero backend. "Opened from the palette" is a stronger relevance signal
 * than "recently edited": the doc you keep jumping to should be the first
 * suggestion, even if something else was saved more recently.
 */

const KEY = "wryte:palette:recent-docs";
const MAX_ENTRIES = 30;

export function recordDocOpen(id: string): void {
  try {
    const list = getRecentDocOpens().filter((x) => x !== id);
    list.unshift(id);
    localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX_ENTRIES)));
  } catch {
    // Quota/privacy-mode failures just lose the ranking hint.
  }
}

/** Document ids, most recently opened first. */
export function getRecentDocOpens(): string[] {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed)
      ? parsed.filter((x): x is string => typeof x === "string")
      : [];
  } catch {
    return [];
  }
}

/** Ranking boost for search results: recent opens float up, decaying fast. */
export function openBoost(rank: number | undefined): number {
  if (rank === undefined) return 0;
  return Math.max(0, 12 - rank * 2);
}
