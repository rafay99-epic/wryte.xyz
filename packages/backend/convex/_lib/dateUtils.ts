export function isValidTimezone(tz: string): boolean {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export function dateInTimezone(epochMs: number, tz: string): string {
  const safeTz = isValidTimezone(tz) ? tz : "UTC";
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: safeTz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return formatter.format(new Date(epochMs));
}

export function yesterdayStr(todayYMD: string): string {
  const d = new Date(`${todayYMD}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

export const RECENT_ACTIVITY_DAYS = 84;

export function updateRecentActivity(
  existing: Array<{ date: string; words: number }>,
  todayStr: string,
  delta: number,
): Array<{ date: string; words: number }> {
  const copy = [...existing];
  const todayEntry = copy.find((e) => e.date === todayStr);
  if (todayEntry) {
    todayEntry.words = Math.max(0, todayEntry.words + delta);
  } else {
    copy.push({ date: todayStr, words: Math.max(0, delta) });
  }
  copy.sort((a, b) => a.date.localeCompare(b.date));
  if (copy.length > RECENT_ACTIVITY_DAYS) {
    copy.splice(0, copy.length - RECENT_ACTIVITY_DAYS);
  }
  return copy;
}
