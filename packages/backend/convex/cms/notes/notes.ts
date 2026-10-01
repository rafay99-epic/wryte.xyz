import {
  paginationOptsValidator,
  paginationResultValidator,
} from "convex/server";
import { v } from "convex/values";
import { internal } from "../../_generated/api";
import { internalMutation, mutation, query } from "../../_generated/server";
import { getAuthedUserOrNull, getCurrentUser } from "../../_lib/auth";
import { rateLimiter } from "../../_lib/rateLimits";
import { createDocumentForUser } from "../documents";
import { loadContentRow, requireLiveNote } from "./_lib/access";
import {
  MAX_NOTE_LINKS,
  noteMetaValidator,
  noteRowValidator,
  noteStatusValidator,
  searchHitValidator,
  trashedNoteRowValidator,
} from "./_lib/model";
import { purgeNote, purgeTrashedNotes } from "./_lib/purge";
import {
  getNoteBodyForUser,
  getNoteMetaForUser,
  listNotesForUser,
  listTrashForUser,
  searchNotesForUser,
  tasksForUser,
} from "./_lib/read";
import {
  createNoteForUser,
  emptyTrashForUser,
  purgeNoteForUser,
  restoreNoteForUser,
  saveNoteForUser,
  trashNoteForUser,
  updateNoteForUser,
} from "./_lib/write";

const EMPTY_PAGE = { page: [], isDone: true, continueCursor: "" };

export const list = query({
  args: {
    paginationOpts: paginationOptsValidator,
    groupId: v.optional(v.id("note_groups")),
  },
  returns: paginationResultValidator(noteRowValidator),
  handler: async (ctx, args) => {
    const user = await getAuthedUserOrNull(ctx);
    if (!user) return EMPTY_PAGE;
    return await listNotesForUser(ctx, user, args);
  },
});

export const trashList = query({
  args: { paginationOpts: paginationOptsValidator },
  returns: paginationResultValidator(trashedNoteRowValidator),
  handler: async (ctx, args) => {
    const user = await getAuthedUserOrNull(ctx);
    if (!user) return EMPTY_PAGE;
    return await listTrashForUser(ctx, user, args.paginationOpts);
  },
});

export const tasks = query({
  args: {},
  returns: v.object({
    todo: v.array(noteRowValidator),
    doing: v.array(noteRowValidator),
    done: v.array(noteRowValidator),
  }),
  handler: async (ctx) => {
    const user = await getAuthedUserOrNull(ctx);
    if (!user) return { todo: [], doing: [], done: [] };
    return await tasksForUser(ctx, user);
  },
});

export const getMeta = query({
  args: { noteId: v.id("notes") },
  returns: v.union(v.null(), noteMetaValidator),
  handler: async (ctx, args) => {
    const user = await getAuthedUserOrNull(ctx);
    if (!user) return null;
    return await getNoteMetaForUser(ctx, user, args.noteId);
  },
});

export const getBody = query({
  args: { noteId: v.id("notes") },
  returns: v.union(
    v.null(),
    v.object({ content: v.string(), rev: v.number() }),
  ),
  handler: async (ctx, args) => {
    const user = await getAuthedUserOrNull(ctx);
    if (!user) return null;
    return await getNoteBodyForUser(ctx, user, args.noteId);
  },
});

export const search = query({
  args: { query: v.string() },
  returns: v.array(searchHitValidator),
  handler: async (ctx, args) => {
    const user = await getAuthedUserOrNull(ctx);
    if (!user) return [];
    return await searchNotesForUser(ctx, user, args);
  },
});

export const create = mutation({
  args: {
    title: v.optional(v.string()),
    content: v.optional(v.string()),
    groupId: v.optional(v.id("note_groups")),
    status: v.optional(noteStatusValidator),
    dueDate: v.optional(v.string()),
    writer: v.string(),
  },
  returns: v.id("notes"),
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    const { noteId } = await createNoteForUser(ctx, user, {
      ...args,
      source: "app",
    });
    return noteId;
  },
});

export const save = mutation({
  args: {
    noteId: v.id("notes"),
    content: v.string(),
    title: v.optional(v.string()),
    writer: v.string(),
    flush: v.optional(v.boolean()),
    baseRev: v.optional(v.number()),
  },
  returns: v.object({ rev: v.number(), touched: v.boolean() }),
  handler: async (ctx, args) =>
    await saveNoteForUser(ctx, await getCurrentUser(ctx), args),
});

export const update = mutation({
  args: {
    noteId: v.id("notes"),
    writer: v.string(),
    title: v.optional(v.string()),
    groupId: v.optional(v.union(v.id("note_groups"), v.null())),
    status: v.optional(v.union(noteStatusValidator, v.null())),
    dueDate: v.optional(v.union(v.string(), v.null())),
    pinned: v.optional(v.boolean()),
  },
  returns: v.object({ rev: v.number() }),
  handler: async (ctx, args) => {
    const { rev } = await updateNoteForUser(ctx, await getCurrentUser(ctx), {
      ...args,
      source: "app",
    });
    return { rev };
  },
});

export const trash = mutation({
  args: { noteId: v.id("notes") },
  returns: v.null(),
  handler: async (ctx, args) =>
    await trashNoteForUser(ctx, await getCurrentUser(ctx), args.noteId),
});

export const restore = mutation({
  args: { noteId: v.id("notes") },
  returns: v.null(),
  handler: async (ctx, args) =>
    await restoreNoteForUser(ctx, await getCurrentUser(ctx), args.noteId),
});

export const purge = mutation({
  args: { noteId: v.id("notes") },
  returns: v.null(),
  handler: async (ctx, args) =>
    await purgeNoteForUser(ctx, await getCurrentUser(ctx), args.noteId),
});

export const emptyTrash = mutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    const { more } = await emptyTrashForUser(ctx, user);
    if (more) {
      await ctx.scheduler.runAfter(
        0,
        internal.cms.notes.notes._emptyTrashBatch,
        {
          userId: user._id,
        },
      );
    }
    return null;
  },
});

export const _emptyTrashBatch = internalMutation({
  args: { userId: v.id("users") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { more } = await purgeTrashedNotes(ctx, args.userId);
    if (more) {
      await ctx.scheduler.runAfter(
        0,
        internal.cms.notes.notes._emptyTrashBatch,
        {
          userId: args.userId,
        },
      );
    }
    return null;
  },
});

const TRASH_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
const EXPIRED_BATCH = 20;

export const _purgeExpiredTrash = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const cutoff = Date.now() - TRASH_RETENTION_MS;
    const expired = await ctx.db
      .query("notes")
      .withIndex("by_trashedAt", (q) =>
        q.gt("trashedAt", 0).lt("trashedAt", cutoff),
      )
      .take(EXPIRED_BATCH);
    for (const note of expired) {
      await purgeNote(ctx, note);
    }
    if (expired.length === EXPIRED_BATCH) {
      await ctx.scheduler.runAfter(
        0,
        internal.cms.notes.notes._purgeExpiredTrash,
        {},
      );
    }
    return null;
  },
});

export const convertToArticle = mutation({
  args: {
    noteId: v.id("notes"),
    projectId: v.id("projects"),
    title: v.string(),
    slug: v.string(),
    frontmatter: v.optional(v.string()),
  },
  returns: v.id("documents"),
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    await rateLimiter.limit(ctx, "notes:convert", {
      key: user.tokenIdentifier,
      throws: true,
    });
    const note = await requireLiveNote(ctx, user, args.noteId);
    const project = await ctx.db.get(args.projectId);
    if (!project || project.userId !== user._id) {
      throw new Error("Project not found");
    }
    const existingLinks = await ctx.db
      .query("note_links")
      .withIndex("by_noteId", (q) => q.eq("noteId", note._id))
      .take(MAX_NOTE_LINKS);
    if (existingLinks.length >= MAX_NOTE_LINKS) {
      throw new Error(
        `A note can link to at most ${String(MAX_NOTE_LINKS)} articles. Remove a link first.`,
      );
    }
    const row = await loadContentRow(ctx, note._id);
    const documentId = await createDocumentForUser(ctx, user, {
      projectId: project._id,
      title: args.title,
      slug: args.slug,
      content: row?.content ?? "",
      ...(args.frontmatter !== undefined
        ? { frontmatter: args.frontmatter }
        : {}),
    });
    await ctx.db.insert("note_links", {
      noteId: note._id,
      documentId,
      userId: user._id,
    });
    return documentId;
  },
});
