import type { PaginationOptions, PaginationResult } from "convex/server";
import type { Doc, Id } from "../../../_generated/dataModel";
import type { QueryCtx } from "../../../_generated/server";
import { loadContentRow, loadOwnedNote } from "./access";
import { linksForNote, notesForDocument } from "./links";
import {
  type NoteLink,
  type NoteMeta,
  type NoteRow,
  type NoteStatus,
  type SearchHit,
  snippet,
  type TrashedNoteRow,
  toNoteMeta,
  toNoteRow,
  toTrashedNoteRow,
} from "./model";

const TASK_LIMIT = 200;
const DONE_LIMIT = 50;
const SEARCH_LIMIT = 8;

type DbCtx = { db: QueryCtx["db"] };

function mapPage<T, U>(
  result: PaginationResult<T>,
  map: (item: T) => U,
): PaginationResult<U> {
  return { ...result, page: result.page.map(map) };
}

export async function listNotesForUser(
  ctx: DbCtx,
  user: Doc<"users">,
  args: {
    paginationOpts: PaginationOptions;
    groupId?: Id<"note_groups">;
    status?: NoteStatus;
    dueBefore?: string;
    linkedDocumentId?: Id<"documents">;
  },
): Promise<PaginationResult<NoteRow>> {
  if (args.linkedDocumentId !== undefined) {
    const rows = await notesForDocument(ctx, user, args.linkedDocumentId);
    return {
      page: rows.filter(
        (row) =>
          (args.groupId === undefined || row.groupId === args.groupId) &&
          (args.status === undefined || row.status === args.status),
      ),
      isDone: true,
      continueCursor: "",
    };
  }

  const status = args.status;
  if (status !== undefined) {
    const dueBefore = args.dueBefore;
    const base = ctx.db.query("notes");
    const ranged =
      dueBefore === undefined
        ? base.withIndex(
            "by_userId_and_trashedAt_and_status_and_dueDate",
            (q) =>
              q
                .eq("userId", user._id)
                .eq("trashedAt", undefined)
                .eq("status", status),
          )
        : base.withIndex(
            "by_userId_and_trashedAt_and_status_and_dueDate",
            (q) =>
              q
                .eq("userId", user._id)
                .eq("trashedAt", undefined)
                .eq("status", status)
                .gte("dueDate", "")
                .lt("dueDate", dueBefore),
          );
    const result = await ranged.paginate(args.paginationOpts);
    const groupId = args.groupId;
    return mapPage(
      {
        ...result,
        page:
          groupId === undefined
            ? result.page
            : result.page.filter((note) => note.groupId === groupId),
      },
      toNoteRow,
    );
  }

  const groupId = args.groupId;
  const result =
    groupId === undefined
      ? await ctx.db
          .query("notes")
          .withIndex("by_userId_and_trashedAt_and_updatedAt", (q) =>
            q.eq("userId", user._id).eq("trashedAt", undefined),
          )
          .order("desc")
          .paginate(args.paginationOpts)
      : await ctx.db
          .query("notes")
          .withIndex("by_userId_and_trashedAt_and_groupId_and_updatedAt", (q) =>
            q
              .eq("userId", user._id)
              .eq("trashedAt", undefined)
              .eq("groupId", groupId),
          )
          .order("desc")
          .paginate(args.paginationOpts);
  return mapPage(result, toNoteRow);
}

export async function listTrashForUser(
  ctx: DbCtx,
  user: Doc<"users">,
  paginationOpts: PaginationOptions,
): Promise<PaginationResult<TrashedNoteRow>> {
  const result = await ctx.db
    .query("notes")
    .withIndex("by_userId_and_trashedAt_and_updatedAt", (q) =>
      q.eq("userId", user._id).gt("trashedAt", 0),
    )
    .order("desc")
    .paginate(paginationOpts);
  return mapPage(result, (note) => toTrashedNoteRow(note, note.trashedAt ?? 0));
}

async function openTasks(
  ctx: DbCtx,
  userId: Id<"users">,
  status: "todo" | "doing",
): Promise<NoteRow[]> {
  const notes = await ctx.db
    .query("notes")
    .withIndex("by_userId_and_trashedAt_and_status_and_dueDate", (q) =>
      q.eq("userId", userId).eq("trashedAt", undefined).eq("status", status),
    )
    .take(TASK_LIMIT);
  return notes.map(toNoteRow);
}

export async function tasksForUser(
  ctx: DbCtx,
  user: Doc<"users">,
): Promise<{ todo: NoteRow[]; doing: NoteRow[]; done: NoteRow[] }> {
  const [todo, doing, done] = await Promise.all([
    openTasks(ctx, user._id, "todo"),
    openTasks(ctx, user._id, "doing"),
    ctx.db
      .query("notes")
      .withIndex("by_userId_and_trashedAt_and_completedAt", (q) =>
        q
          .eq("userId", user._id)
          .eq("trashedAt", undefined)
          .gte("completedAt", 0),
      )
      .order("desc")
      .take(DONE_LIMIT),
  ]);
  return { todo, doing, done: done.map(toNoteRow) };
}

async function loadLiveNote(
  ctx: DbCtx,
  user: Doc<"users">,
  noteId: Id<"notes">,
): Promise<Doc<"notes"> | null> {
  const note = await loadOwnedNote(ctx, user, noteId);
  return note && note.trashedAt === undefined ? note : null;
}

export async function getNoteMetaForUser(
  ctx: DbCtx,
  user: Doc<"users">,
  noteId: Id<"notes">,
): Promise<NoteMeta | null> {
  const note = await loadLiveNote(ctx, user, noteId);
  return note ? toNoteMeta(note) : null;
}

export async function getNoteBodyForUser(
  ctx: DbCtx,
  user: Doc<"users">,
  noteId: Id<"notes">,
): Promise<{ content: string; rev: number } | null> {
  const note = await loadLiveNote(ctx, user, noteId);
  if (!note) return null;
  const row = await loadContentRow(ctx, note._id);
  return { content: row?.content ?? "", rev: note.rev };
}

export async function getNoteForUser(
  ctx: DbCtx,
  user: Doc<"users">,
  noteId: Id<"notes">,
): Promise<{
  meta: NoteMeta;
  content: string;
  bodyRev: number;
  links: NoteLink[];
} | null> {
  const note = await loadLiveNote(ctx, user, noteId);
  if (!note) return null;
  const [row, links] = await Promise.all([
    loadContentRow(ctx, note._id),
    linksForNote(ctx, note._id),
  ]);
  return {
    meta: toNoteMeta(note),
    content: row?.content ?? "",
    bodyRev: row?.rev ?? 0,
    links,
  };
}

export async function searchNotesForUser(
  ctx: DbCtx,
  user: Doc<"users">,
  args: { query: string },
): Promise<SearchHit[]> {
  const query = args.query.trim();
  if (!query) return [];

  const [byTitle, byContent] = await Promise.all([
    ctx.db
      .query("notes")
      .withSearchIndex("search_title", (q) =>
        q
          .search("title", query)
          .eq("userId", user._id)
          .eq("trashedAt", undefined),
      )
      .take(SEARCH_LIMIT),
    ctx.db
      .query("note_content")
      .withSearchIndex("search_content", (q) =>
        q.search("content", query).eq("userId", user._id).eq("trashed", false),
      )
      .take(SEARCH_LIMIT),
  ]);

  const hits: SearchHit[] = [];
  const seen = new Set<Id<"notes">>();
  for (const row of byContent) {
    const note = await ctx.db.get(row.noteId);
    if (!note || note.userId !== user._id || note.trashedAt !== undefined) {
      continue;
    }
    seen.add(note._id);
    hits.push({
      noteId: note._id,
      title: note.title,
      snippet: snippet(row.content, query),
      ...(note.status !== undefined ? { status: note.status } : {}),
    });
  }
  const titleHits: SearchHit[] = byTitle
    .filter((note) => !seen.has(note._id))
    .map((note) => ({
      noteId: note._id,
      title: note.title,
      snippet: note.excerpt,
      ...(note.status !== undefined ? { status: note.status } : {}),
    }));
  return [...titleHits, ...hits];
}
