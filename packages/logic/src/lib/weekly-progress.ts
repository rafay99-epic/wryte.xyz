/**
 * Rolling 7-day word count, computed client-side from the stats row the
 * dashboard already subscribes to — zero extra Convex reads.
 *
 * `recentActivity` day keys come from the user's stats timezone while
 * `now` is the browser clock; on the rare day they disagree the sum is
 * off by at most one boundary day, and the widget label says "last 7
 * days" rather than pretending calendar-week precision.
 */

export type ActivityDay = { date: string; words: number };

/** Local YYYY-MM-DD key, matching calendar-utils / stats day keys. */
function dayKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Sum of the last 7 days of writing. Today's contribution comes from the
 * live `wordsToday` counter (the activity array's today entry can lag a
 * beat behind it), earlier days from the activity array.
 */
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
