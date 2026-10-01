import type { Doc, Id } from "../../../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../../../_generated/server";
import { requireLiveNote } from "./access";
import {
  MAX_NOTE_LINKS,
  type NoteLink,
  type NoteRow,
  toNoteRow,
} from "./model";

const LINK_SCAN_LIMIT = 50;

export async function linksForNote(
  ctx: { db: QueryCtx["db"] },
  noteId: Id<"notes">,
): Promise<NoteLink[]> {
  const edges = await ctx.db
    .query("note_links")
    .withIndex("by_noteId", (q) => q.eq("noteId", noteId))
    .take(LINK_SCAN_LIMIT);
  const links: NoteLink[] = [];
  for (const edge of edges) {
    const doc = await ctx.db.get(edge.documentId);
    if (!doc || doc.trashedAt !== undefined) continue;
    links.push({
      documentId: doc._id,
      title: doc.title,
      projectId: doc.projectId,
      status: doc.status,
    });
  }
  return links;
}

export async function notesForDocument(
  ctx: { db: QueryCtx["db"] },
  user: Doc<"users">,
  documentId: Id<"documents">,
): Promise<NoteRow[]> {
  const doc = await ctx.db.get(documentId);
  if (!doc || doc.userId !== user._id) return [];
  const edges = await ctx.db
    .query("note_links")
    .withIndex("by_documentId", (q) => q.eq("documentId", documentId))
    .take(LINK_SCAN_LIMIT);
  const rows: NoteRow[] = [];
  for (const edge of edges) {
    const note = await ctx.db.get(edge.noteId);
    if (!note || note.userId !== user._id || note.trashedAt !== undefined) {
      continue;
    }
    rows.push(toNoteRow(note));
  }
  return rows.sort((a, b) => b.updatedAt - a.updatedAt);
}

async function requireLinkableDocument(
  ctx: { db: QueryCtx["db"] },
  user: Doc<"users">,
  documentId: Id<"documents">,
): Promise<void> {
  const doc = await ctx.db.get(documentId);
  if (!doc || doc.userId !== user._id) {
    throw new Error("Linked article not found");
  }
  if (doc.trashedAt !== undefined) {
    throw new Error(`"${doc.title}" is in the trash and cannot be linked`);
  }
}

export async function setNoteLinks(
  ctx: MutationCtx,
  user: Doc<"users">,
  args: { noteId: Id<"notes">; documentIds: Id<"documents">[] },
): Promise<null> {
  const wanted = [...new Set(args.documentIds)];
  if (wanted.length > MAX_NOTE_LINKS) {
    throw new Error(
      `A note can link to at most ${String(MAX_NOTE_LINKS)} articles`,
    );
  }
  const note = await requireLiveNote(ctx, user, args.noteId);
  for (const documentId of wanted) {
    await requireLinkableDocument(ctx, user, documentId);
  }

  const existing = new Set<Id<"documents">>();
  for await (const edge of ctx.db
    .query("note_links")
    .withIndex("by_noteId", (q) => q.eq("noteId", note._id))) {
    if (wanted.includes(edge.documentId) && !existing.has(edge.documentId)) {
      existing.add(edge.documentId);
      continue;
    }
    await ctx.db.delete(edge._id);
  }

  for (const documentId of wanted) {
    if (existing.has(documentId)) continue;
    await ctx.db.insert("note_links", {
      noteId: note._id,
      documentId,
      userId: user._id,
    });
  }
  return null;
}
