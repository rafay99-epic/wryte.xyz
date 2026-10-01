export const DAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

export const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

export function getFirstDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 1).getDay();
}

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function isBeforeToday(date: Date): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d < today;
}

export function getDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function parseDateKey(key: string): Date {
  const parts = key.split("-").map(Number);
  const y = parts[0] ?? 0;
  const m = parts[1] ?? 1;
  const d = parts[2] ?? 1;
  return new Date(y, m - 1, d);
}

export type MonthRange = {
  from: string;
  to: string;
  today: string;
  fromMs: number;
  toMs: number;
};

export function monthRange(
  year: number,
  month: number,
  today: string,
): MonthRange {
  const first = new Date(year, month, 1);
  const next = new Date(year, month + 1, 1);
  return {
    from: getDateKey(first),
    to: getDateKey(new Date(year, month + 1, 0)),
    today,
    fromMs: first.getTime(),
    toMs: next.getTime() - 1,
  };
}

export type NoteEventKind = "due" | "overdue" | "done" | "opened";

export const NOTE_EVENT_LABELS: Record<NoteEventKind, string> = {
  overdue: "Overdue",
  due: "Due",
  opened: "Opened",
  done: "Done",
};

const NOTE_EVENT_ORDER: Record<NoteEventKind, number> = {
  overdue: 0,
  due: 1,
  opened: 2,
  done: 3,
};

type NoteEventTiming = {
  kind: NoteEventKind;
  dueDate?: string | undefined;
  at?: number | undefined;
};

export function noteEventDateKey(
  event: NoteEventTiming,
  today: string,
): string | null {
  switch (event.kind) {
    case "overdue":
      return today;
    case "due":
      return event.dueDate ?? null;
    case "done":
    case "opened":
      return event.at === undefined ? null : getDateKey(new Date(event.at));
  }
}

export function groupNoteEventsByDay<Event extends NoteEventTiming>(
  events: readonly Event[],
  today: string,
): Map<string, Event[]> {
  const byDay = new Map<string, Event[]>();
  for (const event of events) {
    const key = noteEventDateKey(event, today);
    if (key === null) continue;
    const list = byDay.get(key) ?? [];
    list.push(event);
    byDay.set(key, list);
  }
  for (const list of byDay.values()) {
    list.sort((a, b) => NOTE_EVENT_ORDER[a.kind] - NOTE_EVENT_ORDER[b.kind]);
  }
  return byDay;
}
