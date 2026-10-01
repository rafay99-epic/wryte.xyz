import { ConvexError } from "convex/values";
import type { Doc, Id } from "../../../_generated/dataModel";
import type { MutationCtx } from "../../../_generated/server";
import type { DocPatch } from "../../../_lib/docPatch";
import { scheduleWordActivity } from "../../../_lib/projectStats";
import { rateLimiter } from "../../../_lib/rateLimits";
import { shouldTouch } from "../../../_lib/touch";
import { countWords } from "../../../_lib/wordCount";
import {
  loadContentRow,
  requireLiveNote,
  requireOwnedGroup,
  requireOwnedNote,
} from "./access";
import { topOfColumn } from "./board";
import { adjustGroupCount, adjustNoteStats, countLiveNote } from "./counters";
import {
  appendText,
  assertDueDate,
  assertNoteSize,
  buildExcerpt,
  type NoteSource,
  type NoteStatus,
  normalizeTitle,
  searchText,
  statsDelta,
  statusPatch,
  taskFields,
} from "./model";
import { purgeNote, purgeTrashedNotes } from "./purge";
import { setSearchTrashed, writeSearchText } from "./search";

async function limit(
  ctx: MutationCtx,
  user: Doc<"users">,
  name:
    | "notes:create"
    | "notes:save"
    | "notes:update"
    | "notes:append"
    | "notes:trash"
    | "notes:emptyTrash",
): Promise<void> {
  await rateLimiter.limit(ctx, name, {
    key: user.tokenIdentifier,
    throws: true,
  });
}

async function writeBody(
  ctx: MutationCtx,
  note: Doc<"notes">,
  content: string,
  row?: Doc<"note_content"> | null,
): Promise<number> {
  const current = row === undefined ? await loadContentRow(ctx, note._id) : row;
  if (!current) {
    await ctx.db.insert("note_content", {
      noteId: note._id,
      userId: note.userId,
      content,
      trashed: note.trashedAt !== undefined,
      rev: 1,
    });
    return 1;
  }
  const bodyRev = current.rev ?? 0;
  if (current.content === content) return bodyRev;
  await ctx.db.patch(current._id, { content, rev: bodyRev + 1 });
  return bodyRev + 1;
}

function assertBaseRev(
  note: Doc<"notes">,
  writer: string,
  baseRev: number | undefined,
): void {
  if (baseRev === undefined) return;
  if (note.rev > baseRev && note.writer !== writer) {
    throw new ConvexError({
      code: "NOTE_CHANGED",
      message: "This note changed elsewhere. Reload it or keep your version.",
      rev: note.rev,
    });
  }
}

async function recordWords(
  ctx: MutationCtx,
  source: NoteSource,
  userId: Id<"users">,
  wordCountDelta: number,
): Promise<void> {
  if (source !== "app") return;
  await scheduleWordActivity(ctx, { userId, wordCountDelta });
}

async function touchNote(
  ctx: MutationCtx,
  note: Doc<"notes">,
  args: {
    content: string;
    title: string;
    writer: string;
    source: NoteSource;
    now: number;
  },
): Promise<number> {
  const wordCount = countWords(args.content);
  const rev = note.rev + 1;
  await ctx.db.patch(note._id, {
    title: args.title,
    excerpt: buildExcerpt(args.content),
    wordCount,
    rev,
    writer: args.writer,
    source: args.source,
    updatedAt: args.now,
  });
  await writeSearchText(ctx, note, args.content);
  await recordWords(ctx, args.source, note.userId, wordCount - note.wordCount);
  return rev;
}

export async function createNoteForUser(
  ctx: MutationCtx,
  user: Doc<"users">,
  args: {
    title?: string;
    content?: string;
    groupId?: Id<"note_groups">;
    status?: NoteStatus;
    dueDate?: string;
    writer: string;
    source: NoteSource;
  },
): Promise<{ noteId: Id<"notes">; rev: number; bodyRev: number }> {
  await limit(ctx, user, "notes:create");
  if (args.groupId !== undefined) {
    await requireOwnedGroup(ctx, user, args.groupId);
  }
  if (args.dueDate !== undefined) assertDueDate(args.dueDate);
  const content = args.content ?? "";
  assertNoteSize(content);

  const now = Date.now();
  const status = args.status ?? (args.dueDate !== undefined ? "todo" : null);
  const wordCount = countWords(content);
  const rev = 1;
  const boardPosition = await topOfColumn(ctx, user._id, status ?? undefined);
  const noteId = await ctx.db.insert("notes", {
    userId: user._id,
    title: normalizeTitle(args.title ?? ""),
    excerpt: buildExcerpt(content),
    wordCount,
    ...(args.groupId !== undefined ? { groupId: args.groupId } : {}),
    ...(status !== null ? taskFields(status, now) : {}),
    ...(status !== null && args.dueDate !== undefined
      ? { dueDate: args.dueDate }
      : {}),
    boardPosition,
    rev,
    writer: args.writer,
    source: args.source,
    createdAt: now,
    updatedAt: now,
  });
  await ctx.db.insert("note_content", {
    noteId,
    userId: user._id,
    content,
    trashed: false,
    rev: 1,
  });
  await ctx.db.insert("note_search", {
    noteId,
    userId: user._id,
    trashed: false,
    text: searchText(content),
  });
  await countLiveNote(
    ctx,
    {
      userId: user._id,
      ...(args.groupId !== undefined ? { groupId: args.groupId } : {}),
      ...(status !== null ? { status } : {}),
    },
    "add",
  );
  await recordWords(ctx, args.source, user._id, wordCount);
  return { noteId, rev, bodyRev: 1 };
}

export async function saveNoteForUser(
  ctx: MutationCtx,
  user: Doc<"users">,
  args: {
    noteId: Id<"notes">;
    content?: string;
    title?: string;
    writer: string;
    flush?: boolean;
    baseRev?: number;
  },
): Promise<{ rev: number; touched: boolean }> {
  await limit(ctx, user, "notes:save");
  const note = await requireLiveNote(ctx, user, args.noteId);
  assertBaseRev(note, args.writer, args.baseRev);
  let content = args.content;
  if (content === undefined) {
    if (args.flush !== true) {
      throw new Error("content is required unless flush is true");
    }
  } else {
    assertNoteSize(content);
    await writeBody(ctx, note, content);
  }

  const title =
    args.title === undefined ? note.title : normalizeTitle(args.title);
  const now = Date.now();
  const touched = shouldTouch({
    now,
    updatedAt: note.updatedAt,
    flush: args.flush ?? false,
    titleChanged: title !== note.title,
  });
  if (!touched) return { rev: note.rev, touched };

  content ??= (await loadContentRow(ctx, note._id))?.content ?? "";
  const rev = await touchNote(ctx, note, {
    content,
    title,
    writer: args.writer,
    source: "app",
    now,
  });
  return { rev, touched };
}

export async function appendToNoteForUser(
  ctx: MutationCtx,
  user: Doc<"users">,
  args: {
    noteId: Id<"notes">;
    text: string;
    writer: string;
    source: NoteSource;
  },
): Promise<{ rev: number; bodyRev: number }> {
  await limit(ctx, user, "notes:append");
  if (!args.text.trim()) throw new Error("Nothing to append");
  const note = await requireLiveNote(ctx, user, args.noteId);
  const row = await loadContentRow(ctx, note._id);
  const content = appendText(row?.content ?? "", args.text);
  assertNoteSize(content);
  const bodyRev = await writeBody(ctx, note, content, row);
  const rev = await touchNote(ctx, note, {
    content,
    title: note.title,
    writer: args.writer,
    source: args.source,
    now: Date.now(),
  });
  return { rev, bodyRev };
}

export async function updateNoteForUser(
  ctx: MutationCtx,
  user: Doc<"users">,
  args: {
    noteId: Id<"notes">;
    writer: string;
    source: NoteSource;
    title?: string;
    groupId?: Id<"note_groups"> | null;
    status?: NoteStatus | null;
    dueDate?: string | null;
    pinned?: boolean;
    content?: string;
    expectedRev?: number;
  },
): Promise<{ rev: number; bodyRev: number }> {
  await limit(ctx, user, "notes:update");
  const note = await requireLiveNote(ctx, user, args.noteId);
  const row = await loadContentRow(ctx, note._id);
  let bodyRev = row?.rev ?? 0;
  if (args.expectedRev !== undefined && args.expectedRev !== bodyRev) {
    throw new Error(
      `Note changed since rev ${String(args.expectedRev)} (now rev ${String(bodyRev)}). Read it again before updating.`,
    );
  }

  const now = Date.now();
  const rev = note.rev + 1;
  const patch: DocPatch<"notes"> = {
    rev,
    writer: args.writer,
    source: args.source,
    updatedAt: now,
  };

  if (args.title !== undefined) patch.title = normalizeTitle(args.title);
  if (args.pinned !== undefined) patch.pinned = args.pinned || undefined;

  if (args.groupId !== undefined) {
    const nextGroup = args.groupId ?? undefined;
    if (nextGroup !== note.groupId) {
      if (nextGroup !== undefined) {
        await requireOwnedGroup(ctx, user, nextGroup);
      }
      await adjustGroupCount(ctx, note.groupId, -1);
      await adjustGroupCount(ctx, nextGroup, 1);
      patch.groupId = nextGroup;
    }
  }

  const dueDate = args.dueDate;
  if (typeof dueDate === "string") assertDueDate(dueDate);
  let nextStatus =
    args.status === undefined ? (note.status ?? null) : args.status;
  if (typeof dueDate === "string" && nextStatus === null) {
    if (args.status === null) {
      throw new Error("A note without a task status cannot have a due date");
    }
    nextStatus = "todo";
  }
  Object.assign(patch, statusPatch(note, nextStatus, now));
  if ((nextStatus ?? undefined) !== note.status) {
    patch.boardPosition = await topOfColumn(
      ctx,
      user._id,
      nextStatus ?? undefined,
    );
  }
  await adjustNoteStats(
    ctx,
    user._id,
    statsDelta(note.status, nextStatus ?? undefined),
  );
  if (dueDate !== undefined && nextStatus !== null) {
    patch.dueDate = dueDate ?? undefined;
  }

  if (args.content !== undefined) {
    if (args.expectedRev === undefined) {
      throw new Error("expectedRev is required to replace note content");
    }
    assertNoteSize(args.content);
    bodyRev = await writeBody(ctx, note, args.content, row);
    const wordCount = countWords(args.content);
    patch.excerpt = buildExcerpt(args.content);
    patch.wordCount = wordCount;
    await writeSearchText(ctx, note, args.content);
    await recordWords(ctx, args.source, user._id, wordCount - note.wordCount);
  }

  await ctx.db.patch(note._id, patch);
  return { rev, bodyRev };
}

export async function trashNoteForUser(
  ctx: MutationCtx,
  user: Doc<"users">,
  noteId: Id<"notes">,
): Promise<null> {
  await limit(ctx, user, "notes:trash");
  const note = await requireOwnedNote(ctx, user, noteId);
  if (note.trashedAt !== undefined) return null;
  await ctx.db.patch(note._id, { trashedAt: Date.now() });
  await setSearchTrashed(ctx, note._id, true);
  await countLiveNote(ctx, note, "remove");
  return null;
}

export async function restoreNoteForUser(
  ctx: MutationCtx,
  user: Doc<"users">,
  noteId: Id<"notes">,
): Promise<null> {
  await limit(ctx, user, "notes:trash");
  const note = await requireOwnedNote(ctx, user, noteId);
  if (note.trashedAt === undefined) return null;
  const group =
    note.groupId === undefined ? null : await ctx.db.get(note.groupId);
  const groupId = group?._id;
  await ctx.db.patch(note._id, { trashedAt: undefined, groupId });
  await setSearchTrashed(ctx, note._id, false);
  await countLiveNote(
    ctx,
    {
      userId: note.userId,
      ...(groupId !== undefined ? { groupId } : {}),
      ...(note.status !== undefined ? { status: note.status } : {}),
    },
    "add",
  );
  return null;
}

export async function purgeNoteForUser(
  ctx: MutationCtx,
  user: Doc<"users">,
  noteId: Id<"notes">,
): Promise<null> {
  await limit(ctx, user, "notes:trash");
  const note = await requireOwnedNote(ctx, user, noteId);
  if (note.trashedAt === undefined) {
    throw new Error("Move the note to the trash before deleting it forever");
  }
  await purgeNote(ctx, note);
  return null;
}

export async function emptyTrashForUser(
  ctx: MutationCtx,
  user: Doc<"users">,
): Promise<{ deleted: number; more: boolean }> {
  await limit(ctx, user, "notes:emptyTrash");
  return await purgeTrashedNotes(ctx, user._id);
}
