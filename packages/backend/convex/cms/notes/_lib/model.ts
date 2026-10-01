import { type Infer, v } from "convex/values";
import type { Doc } from "../../../_generated/dataModel";
import type { DocPatch } from "../../../_lib/docPatch";

export const MAX_NOTE_BYTES = 300 * 1024;
export const MAX_TITLE_LENGTH = 200;
export const MAX_NOTE_LINKS = 20;
export const TEXT_PREVIEW_LENGTH = 160;

const DUE_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export const noteStatusValidator = v.union(
  v.literal("todo"),
  v.literal("doing"),
  v.literal("done"),
);
export type NoteStatus = Infer<typeof noteStatusValidator>;

export const noteSourceValidator = v.union(v.literal("app"), v.literal("mcp"));
export type NoteSource = Infer<typeof noteSourceValidator>;

const noteRowFields = {
  _id: v.id("notes"),
  title: v.string(),
  excerpt: v.string(),
  status: v.optional(noteStatusValidator),
  dueDate: v.optional(v.string()),
  groupId: v.optional(v.id("note_groups")),
  pinned: v.optional(v.boolean()),
  wordCount: v.number(),
  updatedAt: v.number(),
  completedAt: v.optional(v.number()),
};

export const noteRowValidator = v.object(noteRowFields);
export type NoteRow = Infer<typeof noteRowValidator>;

export const trashedNoteRowValidator = v.object({
  ...noteRowFields,
  trashedAt: v.number(),
});
export type TrashedNoteRow = Infer<typeof trashedNoteRowValidator>;

export const noteMetaValidator = v.object({
  ...noteRowFields,
  rev: v.number(),
  writer: v.string(),
  source: noteSourceValidator,
  createdAt: v.number(),
  taskOpenedAt: v.optional(v.number()),
});
export type NoteMeta = Infer<typeof noteMetaValidator>;

export const groupRowValidator = v.object({
  _id: v.id("note_groups"),
  name: v.string(),
  color: v.optional(v.string()),
  sortOrder: v.number(),
  noteCount: v.number(),
});
export type GroupRow = Infer<typeof groupRowValidator>;

export const calendarEventKindValidator = v.union(
  v.literal("due"),
  v.literal("overdue"),
  v.literal("done"),
  v.literal("opened"),
);

export const calendarEventValidator = v.object({
  noteId: v.id("notes"),
  title: v.string(),
  status: v.optional(noteStatusValidator),
  kind: calendarEventKindValidator,
  dueDate: v.optional(v.string()),
  at: v.optional(v.number()),
  groupId: v.optional(v.id("note_groups")),
});
export type CalendarEvent = Infer<typeof calendarEventValidator>;

export const noteLinkValidator = v.object({
  documentId: v.id("documents"),
  title: v.string(),
  projectId: v.id("projects"),
  status: v.string(),
});
export type NoteLink = Infer<typeof noteLinkValidator>;

export const searchHitValidator = v.object({
  noteId: v.id("notes"),
  title: v.string(),
  snippet: v.string(),
  status: v.optional(noteStatusValidator),
});
export type SearchHit = Infer<typeof searchHitValidator>;

export type StatsDelta = { todo: number; doing: number };

export type TaskFields = Pick<
  DocPatch<"notes">,
  "status" | "dueDate" | "taskOpenedAt" | "completedAt"
>;

export function noteByteLength(content: string): number {
  return new TextEncoder().encode(content).byteLength;
}

export function assertNoteSize(content: string): void {
  const bytes = noteByteLength(content);
  if (bytes > MAX_NOTE_BYTES) {
    throw new Error(
      `Note is too large: ${String(Math.ceil(bytes / 1024))} KB, the limit is ${String(MAX_NOTE_BYTES / 1024)} KB. Nothing was saved.`,
    );
  }
}

export function appendText(content: string, text: string): string {
  if (!content) return text;
  return content.endsWith("\n") ? `${content}${text}` : `${content}\n${text}`;
}

export function normalizeTitle(title: string): string {
  return title.trim().slice(0, MAX_TITLE_LENGTH);
}

export function isDueDate(value: string): boolean {
  if (!DUE_DATE_RE.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return (
    !Number.isNaN(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value
  );
}

export function assertDueDate(value: string): void {
  if (!isDueDate(value)) {
    throw new Error(`Due date must be a valid YYYY-MM-DD date, got "${value}"`);
  }
}

export function toPlainText(content: string): string {
  return content
    .replace(/^\s*(```|~~~).*$/gm, "")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[\[([^\]|]*)(?:\|[^\]]*)?\]\]/g, "$1")
    .replace(/<[^>\n]+>/g, "")
    .replace(/^\s{0,3}#{1,6}\s+/gm, "")
    .replace(/^\s{0,3}>\s?/gm, "")
    .replace(/^\s*(?:[-*+]|\d+[.)])\s+(?:\[[ xX]\]\s+)?/gm, "")
    .replace(/^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/gm, "")
    .replace(/[*`~]+/g, "")
    .replace(/(?<!\w)_+|_+(?!\w)/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function clip(text: string): string {
  return text.length > TEXT_PREVIEW_LENGTH
    ? `${text.slice(0, TEXT_PREVIEW_LENGTH - 1).trimEnd()}…`
    : text;
}

export function buildExcerpt(content: string): string {
  return clip(toPlainText(content));
}

export function snippet(content: string, query: string): string {
  const text = toPlainText(content);
  const haystack = text.toLowerCase();
  const hit =
    query
      .toLowerCase()
      .split(/\s+/)
      .filter(Boolean)
      .map((token) => haystack.indexOf(token))
      .filter((index) => index >= 0)
      .sort((a, b) => a - b)[0] ?? 0;

  const room = TEXT_PREVIEW_LENGTH - 2;
  const start = Math.max(0, Math.min(hit - 40, text.length - room));
  const end = Math.min(text.length, start + room);
  const body = text.slice(start, end).trim();
  return `${start > 0 ? "…" : ""}${body}${end < text.length ? "…" : ""}`;
}

export function taskFields(
  status: NoteStatus,
  now: number,
): { status: NoteStatus; taskOpenedAt: number; completedAt?: number } {
  return {
    status,
    taskOpenedAt: now,
    ...(status === "done" ? { completedAt: now } : {}),
  };
}

export function statusPatch(
  prev: { status?: NoteStatus },
  next: NoteStatus | null,
  now: number,
): TaskFields {
  const current = prev.status ?? null;
  if (next === current) return {};
  if (next === null) {
    return {
      status: undefined,
      dueDate: undefined,
      taskOpenedAt: undefined,
      completedAt: undefined,
    };
  }
  if (current === null) return taskFields(next, now);
  if (next === "done") return { status: next, completedAt: now };
  if (current === "done") return { status: next, completedAt: undefined };
  return { status: next };
}

function liveTaskWeight(status: NoteStatus | undefined): StatsDelta {
  return {
    todo: status === "todo" ? 1 : 0,
    doing: status === "doing" ? 1 : 0,
  };
}

export function statsDelta(
  prev: NoteStatus | undefined,
  next: NoteStatus | undefined,
): StatsDelta {
  const before = liveTaskWeight(prev);
  const after = liveTaskWeight(next);
  return { todo: after.todo - before.todo, doing: after.doing - before.doing };
}

export function toNoteRow(note: Doc<"notes">): NoteRow {
  return {
    _id: note._id,
    title: note.title,
    excerpt: note.excerpt,
    wordCount: note.wordCount,
    updatedAt: note.updatedAt,
    ...(note.status !== undefined ? { status: note.status } : {}),
    ...(note.dueDate !== undefined ? { dueDate: note.dueDate } : {}),
    ...(note.groupId !== undefined ? { groupId: note.groupId } : {}),
    ...(note.pinned !== undefined ? { pinned: note.pinned } : {}),
    ...(note.completedAt !== undefined
      ? { completedAt: note.completedAt }
      : {}),
  };
}

export function toTrashedNoteRow(
  note: Doc<"notes">,
  trashedAt: number,
): TrashedNoteRow {
  return { ...toNoteRow(note), trashedAt };
}

export function toNoteMeta(note: Doc<"notes">): NoteMeta {
  return {
    ...toNoteRow(note),
    rev: note.rev,
    writer: note.writer,
    source: note.source,
    createdAt: note.createdAt,
    ...(note.taskOpenedAt !== undefined
      ? { taskOpenedAt: note.taskOpenedAt }
      : {}),
  };
}

export function toGroupRow(group: Doc<"note_groups">): GroupRow {
  return {
    _id: group._id,
    name: group.name,
    sortOrder: group.sortOrder,
    noteCount: group.noteCount,
    ...(group.color !== undefined ? { color: group.color } : {}),
  };
}
