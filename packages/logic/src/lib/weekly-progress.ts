export type ActivityDay = { date: string; words: number };

function dayKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function wordsThisWeek(
  activity: ActivityDay[],
  wordsToday: number,
  now: Date = new Date(),
): number {
  const window = new Set<string>();
  for (let i = 1; i <= 6; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    window.add(dayKey(d));
  }
  const today = dayKey(now);

  let sum = wordsToday;
  for (const entry of activity) {
    if (entry.date !== today && window.has(entry.date)) {
      sum += entry.words;
    }
  }
  return sum;
}
