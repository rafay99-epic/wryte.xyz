import { v } from "convex/values";
import { mcpCallerValidator } from "convex-mcp-gateway";
import type { Doc, Id } from "../../_generated/dataModel";
import type { MutationCtx } from "../../_generated/server";
import { requireCaller } from "../../_lib/auth";
import { rateLimiter } from "../../_lib/rateLimits";
import {
  findOrCreateGroupByName,
  groupsForUser,
  normalizeGroupName,
} from "../../cms/notes/_lib/groups";
import { setNoteLinks } from "../../cms/notes/_lib/links";
import { type NoteRow, noteStatusValidator } from "../../cms/notes/_lib/model";
import {
  getNoteForUser,
  listNotesForUser,
  searchNotesForUser,
} from "../../cms/notes/_lib/read";
import {
  appendToNoteForUser,
  createNoteForUser,
  trashNoteForUser,
  updateNoteForUser,
} from "../../cms/notes/_lib/write";
import { agentMutation, agentQuery } from "../agentFunctions";
import {
  agentDate,
  agentDocumentIds,
  agentMaxChars,
  agentQueryText,
  agentTitle,
} from "../agentInput";

const PAGE_SIZE = 25;
const MCP = "mcp";

function noteUrl(noteId: Id<"notes">): string {
  return `/notes/${noteId}`;
}

function clip(content: string, maxChars: number) {
  if (content.length <= maxChars) return { body: content, truncated: false };
  const code = content.charCodeAt(maxChars - 1);
  const end = code >= 0xd800 && code <= 0xdbff ? maxChars - 1 : maxChars;
  return { body: content.slice(0, end), truncated: true };
}

function compactRow(row: NoteRow, groupNames: Map<string, string>) {
  const group =
    row.groupId === undefined ? undefined : groupNames.get(row.groupId);
  return {
    noteId: row._id,
    title: row.title,
    excerpt: row.excerpt,
    wordCount: row.wordCount,
    updatedAt: row.updatedAt,
    ...(row.status !== undefined ? { status: row.status } : {}),
    ...(row.dueDate !== undefined ? { dueDate: row.dueDate } : {}),
    ...(group !== undefined ? { group } : {}),
    ...(row.pinned ? { pinned: true } : {}),
  };
}

async function linkDocuments(
  ctx: MutationCtx,
  user: Doc<"users">,
  noteId: Id<"notes">,
  documentIds: Id<"documents">[],
): Promise<void> {
  await rateLimiter.limit(ctx, "notes:links", {
    key: user.tokenIdentifier,
    throws: true,
  });
  await setNoteLinks(ctx, user, {
    noteId,
    documentIds: agentDocumentIds(documentIds),
  });
}

export const list = agentQuery({
  args: {
    caller: mcpCallerValidator,
    group: v.optional(v.string()),
    status: v.optional(noteStatusValidator),
    dueBefore: v.optional(v.string()),
    linkedDocumentId: v.optional(v.id("documents")),
    cursor: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireCaller(ctx, args.caller);
    if (args.dueBefore !== undefined && args.status === undefined) {
      throw new Error(
        'dueBefore filters tasks: pass status too ("todo", "doing" or "done").',
      );
    }
    const groups = await groupsForUser(ctx, user._id);
    const groupNames = new Map<string, string>(
      groups.map((group) => [group._id, group.name]),
    );
    let groupId: Id<"note_groups"> | undefined;
    if (args.group !== undefined) {
      const wanted = normalizeGroupName(args.group).toLowerCase();
      const match = groups.find((group) => group.name.toLowerCase() === wanted);
      if (!match) {
        throw new Error(
          `No note group named "${args.group}". See wryte_note_groups_list.`,
        );
      }
      groupId = match._id;
    }

    const result = await listNotesForUser(ctx, user, {
      paginationOpts: { numItems: PAGE_SIZE, cursor: args.cursor ?? null },
      ...(groupId !== undefined ? { groupId } : {}),
      ...(args.status !== undefined ? { status: args.status } : {}),
      ...(args.dueBefore !== undefined
        ? { dueBefore: agentDate(args.dueBefore) }
        : {}),
      ...(args.linkedDocumentId !== undefined
        ? { linkedDocumentId: args.linkedDocumentId }
        : {}),
    });
    return {
      notes: result.page.map((row) => compactRow(row, groupNames)),
      isDone: result.isDone,
      continueCursor: result.isDone ? null : result.continueCursor,
    };
  },
});

export const search = agentQuery({
  args: { caller: mcpCallerValidator, query: v.string() },
  handler: async (ctx, args) => {
    const user = await requireCaller(ctx, args.caller);
    return await searchNotesForUser(ctx, user, {
      query: agentQueryText(args.query),
    });
  },
});

export const get = agentQuery({
  args: {
    caller: mcpCallerValidator,
    noteId: v.id("notes"),
    maxChars: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await requireCaller(ctx, args.caller);
    const maxChars = agentMaxChars(args.maxChars);
    const note = await getNoteForUser(ctx, user, args.noteId);
    if (!note) throw new Error("Note not found");
    const { meta, content, bodyRev, links } = note;
    const group =
      meta.groupId === undefined ? null : await ctx.db.get(meta.groupId);
    return {
      noteId: meta._id,
      url: noteUrl(meta._id),
      title: meta.title,
      rev: bodyRev,
      status: meta.status ?? null,
      dueDate: meta.dueDate ?? null,
      group: group?.name ?? null,
      pinned: meta.pinned ?? false,
      wordCount: meta.wordCount,
      createdAt: meta.createdAt,
      updatedAt: meta.updatedAt,
      completedAt: meta.completedAt ?? null,
      lastWriter: meta.source,
      totalChars: content.length,
      ...clip(content, maxChars),
      links,
    };
  },
});

export const groups = agentQuery({
  args: { caller: mcpCallerValidator },
  handler: async (ctx, args) => {
    const user = await requireCaller(ctx, args.caller);
    const rows = await groupsForUser(ctx, user._id);
    return rows.map((group) => ({
      name: group.name,
      noteCount: group.noteCount,
    }));
  },
});

export const create = agentMutation({
  args: {
    caller: mcpCallerValidator,
    title: v.string(),
    content: v.optional(v.string()),
    group: v.optional(v.string()),
    status: v.optional(noteStatusValidator),
    dueDate: v.optional(v.string()),
    documentIds: v.optional(v.array(v.id("documents"))),
  },
  handler: async (ctx, args) => {
    const user = await requireCaller(ctx, args.caller);
    const groupId =
      args.group === undefined
        ? undefined
        : await findOrCreateGroupByName(ctx, user, args.group);
    const { noteId, bodyRev } = await createNoteForUser(ctx, user, {
      title: agentTitle(args.title),
      writer: MCP,
      source: MCP,
      ...(args.content !== undefined ? { content: args.content } : {}),
      ...(groupId !== undefined ? { groupId } : {}),
      ...(args.status !== undefined ? { status: args.status } : {}),
      ...(args.dueDate !== undefined
        ? { dueDate: agentDate(args.dueDate) }
        : {}),
    });
    if (args.documentIds !== undefined && args.documentIds.length > 0) {
      await linkDocuments(ctx, user, noteId, args.documentIds);
    }
    return { noteId, rev: bodyRev, url: noteUrl(noteId) };
  },
});

export const update = agentMutation({
  args: {
    caller: mcpCallerValidator,
    noteId: v.id("notes"),
    expectedRev: v.optional(v.number()),
    title: v.optional(v.string()),
    content: v.optional(v.string()),
    status: v.optional(v.union(noteStatusValidator, v.null())),
    dueDate: v.optional(v.union(v.string(), v.null())),
    group: v.optional(v.union(v.string(), v.null())),
    documentIds: v.optional(v.array(v.id("documents"))),
  },
  handler: async (ctx, args) => {
    const user = await requireCaller(ctx, args.caller);
    const {
      caller: _caller,
      noteId,
      expectedRev,
      documentIds,
      ...fields
    } = args;
    if (
      documentIds === undefined &&
      Object.values(fields).every((value) => value === undefined)
    ) {
      throw new Error(
        "Nothing to update: pass title, content, status, dueDate, group or documentIds.",
      );
    }
    if (fields.content !== undefined && expectedRev === undefined) {
      throw new Error(
        "expectedRev is required with content. Read the note with wryte_notes_get first, or use wryte_notes_append.",
      );
    }
    const groupId =
      fields.group === undefined || fields.group === null
        ? fields.group
        : await findOrCreateGroupByName(ctx, user, fields.group);
    const { bodyRev } = await updateNoteForUser(ctx, user, {
      noteId,
      writer: MCP,
      source: MCP,
      ...(expectedRev !== undefined ? { expectedRev } : {}),
      ...(fields.title !== undefined
        ? { title: agentTitle(fields.title) }
        : {}),
      ...(fields.content !== undefined ? { content: fields.content } : {}),
      ...(fields.status !== undefined ? { status: fields.status } : {}),
      ...(fields.dueDate !== undefined
        ? {
            dueDate: fields.dueDate === null ? null : agentDate(fields.dueDate),
          }
        : {}),
      ...(groupId !== undefined ? { groupId } : {}),
    });
    if (documentIds !== undefined) {
      await linkDocuments(ctx, user, noteId, documentIds);
    }
    return { rev: bodyRev };
  },
});

export const append = agentMutation({
  args: { caller: mcpCallerValidator, noteId: v.id("notes"), text: v.string() },
  handler: async (ctx, args) => {
    const user = await requireCaller(ctx, args.caller);
    const { bodyRev } = await appendToNoteForUser(ctx, user, {
      noteId: args.noteId,
      text: args.text,
      writer: MCP,
      source: MCP,
    });
    return { rev: bodyRev };
  },
});

export const trash = agentMutation({
  args: { caller: mcpCallerValidator, noteId: v.id("notes") },
  handler: async (ctx, args) => {
    const user = await requireCaller(ctx, args.caller);
    await trashNoteForUser(ctx, user, args.noteId);
    return { ok: true };
  },
});
