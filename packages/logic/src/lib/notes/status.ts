import type { NoteStatus } from "@wryte/backend/cms/notes/_lib/model";

export const NOTE_STATUSES = [
  "todo",
  "doing",
  "done",
] as const satisfies readonly NoteStatus[];

export const NOTE_STATUS_LABELS: Record<NoteStatus, string> = {
  todo: "To do",
  doing: "Doing",
  done: "Done",
};

export function isNoteStatus(value: string): value is NoteStatus {
  return NOTE_STATUSES.some((status) => status === value);
}
