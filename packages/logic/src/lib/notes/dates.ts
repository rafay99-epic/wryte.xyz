import type { NoteStatus } from "@wryte/backend/cms/notes/_lib/model";
import { getDateKey, parseDateKey } from "@wryte/logic/lib/calendar-utils";

const DAY_MS = 24 * 60 * 60 * 1000;

export function todayKey(now: Date = new Date()): string {
  return getDateKey(now);
}

export function dayOffset(dateKey: string, today: string): number {
  return Math.round(
    (parseDateKey(dateKey).getTime() - parseDateKey(today).getTime()) / DAY_MS,
  );
}

export function isOverdue(
  task: { status?: NoteStatus | undefined; dueDate?: string | undefined },
  today: string,
): boolean {
  return (
    (task.status === "todo" || task.status === "doing") &&
    task.dueDate !== undefined &&
    task.dueDate < today
  );
}

export function dueLabel(dueDate: string, today: string): string {
  const offset = dayOffset(dueDate, today);
  if (offset === 0) return "Today";
  if (offset === 1) return "Tomorrow";
  if (offset === -1) return "Yesterday";
  const date = parseDateKey(dueDate);
  const sameYear = date.getFullYear() === parseDateKey(today).getFullYear();
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    ...(sameYear ? {} : { year: "numeric" }),
  });
}

export function dueTone(
  task: { status?: NoteStatus | undefined; dueDate?: string | undefined },
  today: string,
): "overdue" | "today" | "later" {
  if (isOverdue(task, today)) return "overdue";
  return task.dueDate === today && task.status !== "done" ? "today" : "later";
}
