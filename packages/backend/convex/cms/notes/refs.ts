import { v } from "convex/values";
import { mutation, query } from "../../_generated/server";
import { getAuthedUserOrNull, getCurrentUser } from "../../_lib/auth";
import { noteRefValidator, refInputValidator } from "./_lib/model";
import { addRefs, refsForNote, removeRef } from "./_lib/refs";

export const list = query({
  args: { noteId: v.id("notes") },
  returns: v.array(noteRefValidator),
  handler: async (ctx, args) => {
    const user = await getAuthedUserOrNull(ctx);
    if (!user) return [];
    return await refsForNote(ctx, user, args.noteId);
  },
});

export const add = mutation({
  args: { noteId: v.id("notes"), refs: v.array(refInputValidator) },
  returns: v.array(v.id("note_refs")),
  handler: async (ctx, args) =>
    await addRefs(ctx, await getCurrentUser(ctx), args.noteId, args.refs),
});

export const remove = mutation({
  args: { refId: v.id("note_refs") },
  returns: v.null(),
  handler: async (ctx, args) =>
    await removeRef(ctx, await getCurrentUser(ctx), args.refId),
});
