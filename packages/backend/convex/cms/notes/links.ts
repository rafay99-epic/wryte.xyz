import { v } from "convex/values";
import { mutation, query } from "../../_generated/server";
import { getAuthedUserOrNull, getCurrentUser } from "../../_lib/auth";
import { rateLimiter } from "../../_lib/rateLimits";
import { loadOwnedNote } from "./_lib/access";
import { linksForNote, notesForDocument, setNoteLinks } from "./_lib/links";
import { noteLinkValidator, noteRowValidator } from "./_lib/model";

export const forNote = query({
  args: { noteId: v.id("notes") },
  returns: v.array(noteLinkValidator),
  handler: async (ctx, args) => {
    const user = await getAuthedUserOrNull(ctx);
    if (!user) return [];
    const note = await loadOwnedNote(ctx, user, args.noteId);
    if (!note) return [];
    return await linksForNote(ctx, note._id);
  },
});

export const forDocument = query({
  args: { documentId: v.id("documents") },
  returns: v.array(noteRowValidator),
  handler: async (ctx, args) => {
    const user = await getAuthedUserOrNull(ctx);
    if (!user) return [];
    return await notesForDocument(ctx, user, args.documentId);
  },
});

export const set = mutation({
  args: {
    noteId: v.id("notes"),
    documentIds: v.array(v.id("documents")),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    await rateLimiter.limit(ctx, "notes:links", {
      key: user.tokenIdentifier,
      throws: true,
    });
    return await setNoteLinks(ctx, user, args);
  },
});
