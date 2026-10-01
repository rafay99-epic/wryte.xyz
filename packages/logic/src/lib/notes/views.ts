import type { Id } from "@wryte/backend/_generated/dataModel";
import type {
  BoardColumn,
  GroupRow,
  NoteStatus,
} from "@wryte/backend/cms/notes/_lib/model";
import { EDITOR_SESSION_ID } from "@wryte/logic/lib/editor/session";

export type NewNoteArgs = {
  writer: string;
  groupId?: Id<"note_groups">;
  status?: NoteStatus;
};

export const NOTES_PATH = "/notes";

export const NOTES_PAGE_SIZE = 50;

export const MIN_NOTE_SEARCH_TERM = 2;

export function notePath(noteId: string): string {
  return `${NOTES_PATH}/${noteId}`;
}

export function noteIdFromPath(pathname: string): string | null {
  const prefix = `${NOTES_PATH}/`;
  if (!pathname.startsWith(prefix)) return null;
  const id = pathname.slice(prefix.length).split("/")[0];
  return id ? decodeURIComponent(id) : null;
}

export function newNoteArgs(
  column: BoardColumn,
  groupId: Id<"note_groups"> | null,
): NewNoteArgs {
  return {
    writer: EDITOR_SESSION_ID,
    ...(groupId ? { groupId } : {}),
    ...(column !== "notes" ? { status: column } : {}),
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

export function resolveGroupId(
  groupId: Id<"note_groups"> | null,
  groupsById: ReadonlyMap<Id<"note_groups">, GroupRow> | undefined,
): Id<"note_groups"> | null {
  if (groupId === null || !groupsById || groupsById.has(groupId)) {
    return groupId;
  }
  return null;
}
