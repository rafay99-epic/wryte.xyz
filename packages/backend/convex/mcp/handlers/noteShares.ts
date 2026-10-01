import { v } from "convex/values";
import { mcpCallerValidator } from "convex-mcp-gateway";
import { requireCaller } from "../../_lib/auth";
import { groupsForUser, requireGroupNamed } from "../../cms/notes/_lib/groups";
import { shareExpiryValidator } from "../../cms/notes/_lib/shareModel";
import {
  createShareForUser,
  listSharesForUser,
  revokeShareForUser,
  shareUrl,
} from "../../cms/notes/_lib/shares";
import { agentMutation, agentQuery } from "../agentFunctions";

export const share = agentMutation({
  args: {
    caller: mcpCallerValidator,
    noteIds: v.optional(v.array(v.id("notes"))),
    group: v.optional(v.string()),
    title: v.optional(v.string()),
    expiresInDays: v.optional(shareExpiryValidator),
  },
  handler: async (ctx, args) => {
    const user = await requireCaller(ctx, args.caller);
    if ((args.noteIds === undefined) === (args.group === undefined)) {
      throw new Error(
        "Pass either noteIds (1 to 50 notes) or group (a group name), not both.",
      );
    }
    const options = {
      ...(args.title !== undefined ? { title: args.title } : {}),
      ...(args.expiresInDays !== undefined
        ? { expiresInDays: args.expiresInDays }
        : {}),
    };
    const created =
      args.group !== undefined
        ? await createShareForUser(ctx, user, {
            kind: "group",
            groupId: requireGroupNamed(
              await groupsForUser(ctx, user._id),
              args.group,
            )._id,
            ...options,
          })
        : await createShareForUser(ctx, user, {
            kind: new Set(args.noteIds).size === 1 ? "note" : "notes",
            noteIds: args.noteIds ?? [],
            ...options,
          });
    return { ...created, url: shareUrl(created.token) };
  },
});

export const list = agentQuery({
  args: { caller: mcpCallerValidator },
  handler: async (ctx, args) => {
    const user = await requireCaller(ctx, args.caller);
    const rows = await listSharesForUser(ctx, user);
    return rows.map((row) => ({
      shareId: row.shareId,
      kind: row.kind,
      label: row.label,
      url: shareUrl(row.token),
      noteCount: row.noteCount,
      createdAt: row.createdAt,
      ...(row.title !== undefined ? { title: row.title } : {}),
      ...(row.expiresAt !== undefined ? { expiresAt: row.expiresAt } : {}),
    }));
  },
});

export const revoke = agentMutation({
  args: { caller: mcpCallerValidator, shareId: v.id("note_shares") },
  handler: async (ctx, args) => {
    const user = await requireCaller(ctx, args.caller);
    await revokeShareForUser(ctx, user, args.shareId);
    return { ok: true };
  },
});
