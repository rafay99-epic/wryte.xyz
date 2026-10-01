import type { Id } from "@wryte/backend/_generated/dataModel";
import type {
  GroupRow,
  NoteRow,
  NoteStatus,
} from "@wryte/backend/cms/notes/_lib/model";
import { EDITOR_SESSION_ID } from "@wryte/logic/lib/editor/session";

export type NotesView =
  | { kind: "all" }
  | { kind: "pinned" }
  | { kind: "tasks" }
  | { kind: "today" }
  | { kind: "trash" }
  | { kind: "group"; groupId: Id<"note_groups"> };

export type NoteKind = "note" | "task";

export type NewNoteArgs = {
  writer: string;
  groupId?: Id<"note_groups">;
  status?: NoteStatus;
  dueDate?: string;
};

export const NOTES_PATH = "/notes";

export const NOTES_PAGE_SIZE = 50;

export const MIN_NOTE_SEARCH_TERM = 2;

export function notePath(noteId: string): string {
  return `${NOTES_PATH}/${noteId}`;
}

export function isTaskView(view: NotesView): boolean {
  return view.kind === "tasks" || view.kind === "today";
}

export function sameView(a: NotesView, b: NotesView): boolean {
  if (a.kind === "group" && b.kind === "group") return a.groupId === b.groupId;
  return a.kind === b.kind;
}

export function resolveView(
  view: NotesView,
  groupsById: ReadonlyMap<Id<"note_groups">, GroupRow> | undefined,
): NotesView {
  if (view.kind !== "group" || !groupsById || groupsById.has(view.groupId)) {
    return view;
  }
  return { kind: "all" };
}

export function viewLabel(
  view: NotesView,
  groupsById: ReadonlyMap<Id<"note_groups">, GroupRow> | undefined,
): string {
  switch (view.kind) {
    case "all":
      return "All notes";
    case "pinned":
      return "Pinned";
    case "tasks":
      return "Tasks";
    case "today":
      return "Due today";
    case "trash":
      return "Trash";
    case "group":
      return groupsById?.get(view.groupId)?.name ?? "Group";
  }
}

export function newNoteArgs(
  view: NotesView,
  kind: NoteKind,
  today: string,
): NewNoteArgs {
  const asTask = kind === "task";
  return {
    writer: EDITOR_SESSION_ID,
    ...(view.kind === "group" ? { groupId: view.groupId } : {}),
    ...(asTask ? { status: "todo" } : {}),
    ...(asTask && view.kind === "today" ? { dueDate: today } : {}),
  };
}

export function groupLookup(
  groups: readonly GroupRow[],
): ReadonlyMap<Id<"note_groups">, GroupRow> {
  return new Map(groups.map((group) => [group._id, group]));
}

export function moveId<T>(
  ids: readonly T[],
  index: number,
  delta: number,
): T[] {
  const target = index + delta;
  if (index < 0 || target < 0 || target >= ids.length) return [...ids];
  const next = [...ids];
  const [moved] = next.splice(index, 1);
  if (moved === undefined) return [...ids];
  next.splice(target, 0, moved);
  return next;
}

function compareDue(a: NoteRow, b: NoteRow): number {
  if (a.dueDate === b.dueDate) return b.updatedAt - a.updatedAt;
  if (a.dueDate === undefined) return 1;
  if (b.dueDate === undefined) return -1;
  return a.dueDate < b.dueDate ? -1 : 1;
}

export function sortByDue(rows: readonly NoteRow[]): NoteRow[] {
  return [...rows].sort(compareDue);
}

export function dueByToday(
  tasks: { todo: readonly NoteRow[]; doing: readonly NoteRow[] },
  today: string,
): NoteRow[] {
  return sortByDue(
    [...tasks.doing, ...tasks.todo].filter(
      (row) => row.dueDate !== undefined && row.dueDate <= today,
    ),
  );
}
