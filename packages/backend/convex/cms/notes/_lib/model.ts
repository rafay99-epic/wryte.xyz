import { type Infer, v } from "convex/values";
import type { Doc } from "../../../_generated/dataModel";
import type { DocPatch } from "../../../_lib/docPatch";

export const MAX_NOTE_BYTES = 300 * 1024;
export const MAX_TITLE_LENGTH = 200;
export const MAX_NOTE_LINKS = 20;
export const TEXT_PREVIEW_LENGTH = 160;
export const CARD_EXCERPT_LENGTH = 120;
export const SEARCH_TEXT_BYTES = 32 * 1024;
export const PREVIEW_SOURCE_CHARS = 4 * 1024;
export const MAX_NOTE_REFS = 20;
export const MAX_REF_URL_LENGTH = 500;
export const MAX_REF_TEXT_LENGTH = 2000;
export const MAX_REF_AUTHOR_LENGTH = 100;
export const BOARD_GAP = 1024;
export const MIN_BOARD_GAP = 1e-6;

const DUE_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export const noteStatusValidator = v.union(
  v.literal("todo"),
  v.literal("doing"),
  v.literal("done"),
);
export type NoteStatus = Infer<typeof noteStatusValidator>;

export const boardColumnValidator = v.union(
  v.literal("notes"),
  noteStatusValidator,
);
export type BoardColumn = Infer<typeof boardColumnValidator>;

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

const taskRowFields = {
  _id: v.id("notes"),
  title: v.string(),
  status: v.optional(noteStatusValidator),
  dueDate: v.optional(v.string()),
  groupId: v.optional(v.id("note_groups")),
  pinned: v.optional(v.boolean()),
  updatedAt: v.number(),
  completedAt: v.optional(v.number()),
};

export const taskRowValidator = v.object(taskRowFields);
export type TaskRow = Infer<typeof taskRowValidator>;

export const refCountsValidator = v.object({
  pr: v.number(),
  issue: v.number(),
  comment: v.number(),
  link: v.number(),
});
export type RefCounts = Infer<typeof refCountsValidator>;

export const EMPTY_REF_COUNTS: RefCounts = {
  pr: 0,
  issue: 0,
  comment: 0,
  link: 0,
};

export function hasRefs(counts: RefCounts): boolean {
  return counts.pr + counts.issue + counts.comment + counts.link > 0;
}

export function countRefKinds(refs: readonly { kind: RefKind }[]): RefCounts {
  const counts = { ...EMPTY_REF_COUNTS };
  for (const ref of refs) counts[ref.kind] += 1;
  return counts;
}

export const boardCardValidator = v.object({
  _id: v.id("notes"),
  title: v.string(),
  excerpt: v.string(),
  status: v.optional(noteStatusValidator),
  dueDate: v.optional(v.string()),
  groupId: v.optional(v.id("note_groups")),
  refCounts: v.optional(refCountsValidator),
  updatedAt: v.number(),
  completedAt: v.optional(v.number()),
  boardPosition: v.optional(v.number()),
});
export type BoardCard = Infer<typeof boardCardValidator>;

export const refKindValidator = v.union(
  v.literal("pr"),
  v.literal("issue"),
  v.literal("comment"),
  v.literal("link"),
);
export type RefKind = Infer<typeof refKindValidator>;

export const refInputValidator = v.object({
  kind: refKindValidator,
  url: v.optional(v.string()),
  text: v.optional(v.string()),
  author: v.optional(v.string()),
});
export type RefInput = Infer<typeof refInputValidator>;

export const noteRefValidator = v.object({
  _id: v.id("note_refs"),
  kind: refKindValidator,
  url: v.optional(v.string()),
  text: v.optional(v.string()),
  author: v.optional(v.string()),
  createdAt: v.number(),
});
export type NoteRef = Infer<typeof noteRefValidator>;

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

export function clipText(text: string, length: number): string {
  return text.length > length
    ? `${text.slice(0, length - 1).trimEnd()}…`
    : text;
}

function previewSource(content: string, start: number): string {
  const from = Math.max(0, start);
  const head = content.slice(from, from + PREVIEW_SOURCE_CHARS);
  const last = head.charCodeAt(head.length - 1);
  return last >= 0xd800 && last <= 0xdbff ? head.slice(0, -1) : head;
}

export function buildExcerpt(content: string): string {
  return clipText(toPlainText(previewSource(content, 0)), TEXT_PREVIEW_LENGTH);
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function firstHit(text: string, query: string): number {
  const tokens = query.split(/\s+/).filter(Boolean).map(escapeRegExp);
  if (tokens.length === 0) return -1;
  return text.search(new RegExp(tokens.join("|"), "i"));
}

export function snippet(content: string, query: string): string {
  const rawHit = firstHit(content, query);
  const windowStart = rawHit < 0 ? 0 : rawHit - PREVIEW_SOURCE_CHARS / 4;
  const source = previewSource(content, windowStart);
  const text = toPlainText(source);
  const hit = Math.max(0, firstHit(text, query));
  const room = TEXT_PREVIEW_LENGTH - 2;
  const start = Math.max(0, Math.min(hit - 40, text.length - room));
  const end = Math.min(text.length, start + room);
  const body = text.slice(start, end).trim();
  const before = start > 0 || windowStart > 0;
  const after =
    end < text.length ||
    Math.max(0, windowStart) + source.length < content.length;
  return `${before ? "…" : ""}${body}${after ? "…" : ""}`;
}

export function searchText(content: string): string {
  if (content.length * 3 <= SEARCH_TEXT_BYTES) return content;
  const bytes = new TextEncoder().encode(content);
  if (bytes.byteLength <= SEARCH_TEXT_BYTES) return content;
  return new TextDecoder()
    .decode(bytes.subarray(0, SEARCH_TEXT_BYTES))
    .replace(/\uFFFD+$/, "");
}

export function boardPositionBetween(
  above: number | null,
  below: number | null,
): number | null {
  if (above === null && below === null) return 0;
  if (above === null && below !== null) return below - BOARD_GAP;
  if (above !== null && below === null) return above + BOARD_GAP;
  if (above === null || below === null) return null;
  if (below - above < MIN_BOARD_GAP) return null;
  return (above + below) / 2;
}

export function topBoardPosition(min: number | undefined): number {
  return min === undefined ? 0 : min - BOARD_GAP;
}

function trimmedField(
  value: string | undefined,
  max: number,
  label: string,
): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;
  if (trimmed.length > max) {
    throw new Error(`Ref ${label} must be ${String(max)} characters or fewer`);
  }
  return trimmed;
}

function refUrl(value: string | undefined): string | undefined {
  const url = trimmedField(value, MAX_REF_URL_LENGTH, "url");
  if (url === undefined) return undefined;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`Ref url is not a valid URL: "${url.slice(0, 80)}"`);
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new Error("Ref url must start with http:// or https://");
  }
  return url;
}

export function normalizeRef(input: RefInput): RefInput {
  const url = refUrl(input.url);
  const text = trimmedField(input.text, MAX_REF_TEXT_LENGTH, "text");
  const author = trimmedField(input.author, MAX_REF_AUTHOR_LENGTH, "author");
  if (input.kind === "comment" ? !url && !text : !url) {
    throw new Error(
      input.kind === "comment"
        ? "A comment ref needs text or a url"
        : `A ${input.kind} ref needs a url`,
    );
  }
  return {
    kind: input.kind,
    ...(url !== undefined ? { url } : {}),
    ...(text !== undefined ? { text } : {}),
    ...(author !== undefined ? { author } : {}),
  };
}

export function sameRef(a: RefInput, b: RefInput): boolean {
  return a.kind === b.kind && a.url === b.url && a.text === b.text;
}

export function columnStatus(column: BoardColumn): NoteStatus | undefined {
  return column === "notes" ? undefined : column;
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

export function toTaskRow(note: Doc<"notes">): TaskRow {
  return {
    _id: note._id,
    title: note.title,
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

export function toBoardCard(note: Doc<"notes">): BoardCard {
  return {
    _id: note._id,
    title: note.title,
    excerpt: clipText(note.excerpt, CARD_EXCERPT_LENGTH),
    updatedAt: note.updatedAt,
    ...(note.refCounts && hasRefs(note.refCounts)
      ? { refCounts: note.refCounts }
      : {}),
    ...(note.status !== undefined ? { status: note.status } : {}),
    ...(note.dueDate !== undefined ? { dueDate: note.dueDate } : {}),
    ...(note.groupId !== undefined ? { groupId: note.groupId } : {}),
    ...(note.completedAt !== undefined
      ? { completedAt: note.completedAt }
      : {}),
    ...(note.boardPosition !== undefined
      ? { boardPosition: note.boardPosition }
      : {}),
  };
}

export function toNoteRef(ref: Doc<"note_refs">): NoteRef {
  return {
    _id: ref._id,
    kind: ref.kind,
    createdAt: ref.createdAt,
    ...(ref.url !== undefined ? { url: ref.url } : {}),
    ...(ref.text !== undefined ? { text: ref.text } : {}),
    ...(ref.author !== undefined ? { author: ref.author } : {}),
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
