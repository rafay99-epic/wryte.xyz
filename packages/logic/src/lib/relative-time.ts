const MINUTE = 60_000;
const HOUR = MINUTE * 60;
const DAY = HOUR * 24;
const WEEK = DAY * 7;

export function relativeTime(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const mins = Math.floor(diff / MINUTE);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${String(mins)}m ago`;
  const hours = Math.floor(diff / HOUR);
  if (hours < 24) return `${String(hours)}h ago`;
  const days = Math.floor(diff / DAY);
  if (days < 7) return `${String(days)}d ago`;
  return new Date(timestamp).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

export function relativeTimeCompact(timestamp: number): string {
  const diff = Date.now() - timestamp;
  if (diff < HOUR) return `${String(Math.max(1, Math.floor(diff / MINUTE)))}m`;
  if (diff < DAY) return `${String(Math.floor(diff / HOUR))}h`;
  if (diff < WEEK) return `${String(Math.floor(diff / DAY))}d`;
  const weeks = Math.floor(diff / WEEK);
  if (weeks < 5) return `${String(weeks)}w`;
  return `${String(Math.floor(diff / (DAY * 30)))}mo`;
}

export type AgeLevel = "fresh" | "aging" | "stale";

export function getAgeLevel(timestamp: number): AgeLevel {
  const diff = Date.now() - timestamp;
  if (diff < 3 * DAY) return "fresh";
  if (diff < 7 * DAY) return "aging";
  return "stale";
}
