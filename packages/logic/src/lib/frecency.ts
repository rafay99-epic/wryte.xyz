const KEY = "wryte:palette:recent-docs";
const MAX_ENTRIES = 30;

export function recordDocOpen(id: string): void {
  try {
    const list = getRecentDocOpens().filter((x) => x !== id);
    list.unshift(id);
    localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX_ENTRIES)));
  } catch {}
}

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

export function openBoost(rank: number | undefined): number {
  if (rank === undefined) return 0;
  return Math.max(0, 12 - rank * 2);
}
