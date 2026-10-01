import { internal } from "../../../_generated/api";
import type { Doc, Id } from "../../../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../../../_generated/server";
import { appUrl } from "../../../_lib/appUrl";
import { rateLimiter } from "../../../_lib/rateLimits";
import { loadContentRow, requireLiveNote, requireOwnedGroup } from "./access";
import { hasRefs } from "./model";
import { refsForNote } from "./refs";
import {
  bodyFits,
  isShareToken,
  MAX_SHARE_GROUP_NOTES,
  MAX_SHARE_NOTES,
  newShareToken,
  normalizeShareTitle,
  SHARE_BODY_BATCH,
  SHARE_BODY_BYTES,
  SHARE_LIST_LIMIT,
  type ShareCreated,
  type SharedBody,
  type SharedNote,
  type ShareExpiryDays,
  type ShareKind,
  type ShareRow,
  type ShareView,
  sharedBodySize,
  shareExpiresAt,
  shareLabel,
} from "./shareModel";

type DbCtx = { db: QueryCtx["db"] };

export function shareUrl(token: string): string {
  return appUrl(`/shared#${token}`);
}

async function limitShareWrite(
  ctx: MutationCtx,
  user: Doc<"users">,
): Promise<void> {
  await rateLimiter.limit(ctx, "notes:share", {
    key: user.tokenIdentifier,
    throws: true,
  });
}

function uniqueNoteIds(noteIds: readonly Id<"notes">[]): Id<"notes">[] {
  return [...new Set(noteIds)];
}

export async function createShareForUser(
  ctx: MutationCtx,
  user: Doc<"users">,
  args: {
    kind: ShareKind;
    noteIds?: Id<"notes">[];
    groupId?: Id<"note_groups">;
    title?: string;
    expiresInDays?: ShareExpiryDays;
  },
): Promise<ShareCreated> {
  await limitShareWrite(ctx, user);
  const title = normalizeShareTitle(args.title);
  const target =
    args.kind === "group"
      ? await groupTarget(ctx, user, args)
      : await noteTarget(ctx, user, args.kind, args);

  const now = Date.now();
  const expiresAt = shareExpiresAt(now, args.expiresInDays);
  const token = newShareToken();
  const shareId = await ctx.db.insert("note_shares", {
    userId: user._id,
    token,
    kind: args.kind,
    ...target,
    ...(title !== undefined ? { title } : {}),
    createdAt: now,
    ...(expiresAt !== undefined ? { expiresAt } : {}),
  });
  if (expiresAt !== undefined) {
    await ctx.scheduler.runAt(expiresAt, internal.cms.notes.shares._expire, {
      shareId,
    });
  }
  return { shareId, token, ...(expiresAt !== undefined ? { expiresAt } : {}) };
}

async function groupTarget(
  ctx: DbCtx,
  user: Doc<"users">,
  args: { noteIds?: Id<"notes">[]; groupId?: Id<"note_groups"> },
): Promise<{ groupId: Id<"note_groups"> }> {
  if (args.groupId === undefined || args.noteIds !== undefined) {
    throw new Error("A group share needs groupId and no noteIds.");
  }
  const group = await requireOwnedGroup(ctx, user, args.groupId);
  return { groupId: group._id };
}

async function noteTarget(
  ctx: DbCtx,
  user: Doc<"users">,
  kind: "note" | "notes",
  args: { noteIds?: Id<"notes">[]; groupId?: Id<"note_groups"> },
): Promise<{ noteIds: Id<"notes">[] }> {
  if (args.groupId !== undefined) {
    throw new Error("A note share takes noteIds, not groupId.");
  }
  const noteIds = uniqueNoteIds(args.noteIds ?? []);
  if (kind === "note" && noteIds.length !== 1) {
    throw new Error("A single note share needs exactly one note id.");
  }
  if (noteIds.length === 0 || noteIds.length > MAX_SHARE_NOTES) {
    throw new Error(
      `Share between 1 and ${String(MAX_SHARE_NOTES)} notes at a time.`,
    );
  }
  await Promise.all(
    noteIds.map((noteId) => requireLiveNote(ctx, user, noteId)),
  );
  return { noteIds };
}

export async function revokeShareForUser(
  ctx: MutationCtx,
  user: Doc<"users">,
  shareId: Id<"note_shares">,
): Promise<null> {
  await limitShareWrite(ctx, user);
  const share = await ctx.db.get(shareId);
  if (!share || share.userId !== user._id) {
    throw new Error("Share link not found");
  }
  await ctx.db.delete(share._id);
  return null;
}

export async function deleteSharesForGroup(
  ctx: MutationCtx,
  groupId: Id<"note_groups">,
): Promise<void> {
  const shares = await ctx.db
    .query("note_shares")
    .withIndex("by_groupId", (q) => q.eq("groupId", groupId))
    .take(SHARE_LIST_LIMIT);
  for (const share of shares) {
    await ctx.db.delete(share._id);
  }
}

async function shareTargetLabel(
  ctx: DbCtx,
  share: Doc<"note_shares">,
): Promise<{ label: string; noteCount: number }> {
  if (share.kind === "group") {
    const group =
      share.groupId === undefined ? null : await ctx.db.get(share.groupId);
    const owned = group && group.userId === share.userId ? group : null;
    return {
      label: shareLabel({
        kind: "group",
        noteCount: owned?.noteCount ?? 0,
        ...(owned ? { groupName: owned.name } : {}),
      }),
      noteCount: owned?.noteCount ?? 0,
    };
  }
  const noteIds = share.noteIds ?? [];
  const first =
    share.kind === "note" && noteIds[0] !== undefined
      ? await ctx.db.get(noteIds[0])
      : null;
  return {
    label: shareLabel({
      kind: share.kind,
      noteCount: noteIds.length,
      ...(first && first.userId === share.userId
        ? { noteTitle: first.title }
        : {}),
    }),
    noteCount: noteIds.length,
  };
}

export async function listSharesForUser(
  ctx: DbCtx,
  user: Doc<"users">,
): Promise<ShareRow[]> {
  const shares = await ctx.db
    .query("note_shares")
    .withIndex("by_userId_and_createdAt", (q) => q.eq("userId", user._id))
    .order("desc")
    .take(SHARE_LIST_LIMIT);
  return await Promise.all(
    shares.map(async (share) => ({
      shareId: share._id,
      token: share.token,
      kind: share.kind,
      ...(await shareTargetLabel(ctx, share)),
      createdAt: share.createdAt,
      ...(share.title !== undefined ? { title: share.title } : {}),
      ...(share.noteIds !== undefined ? { noteIds: share.noteIds } : {}),
      ...(share.groupId !== undefined ? { groupId: share.groupId } : {}),
      ...(share.expiresAt !== undefined ? { expiresAt: share.expiresAt } : {}),
    })),
  );
}

async function loadShare(
  ctx: DbCtx,
  token: string,
): Promise<Doc<"note_shares"> | null> {
  if (!isShareToken(token)) return null;
  return await ctx.db
    .query("note_shares")
    .withIndex("by_token", (q) => q.eq("token", token))
    .unique();
}

function isSharedLive(
  share: Doc<"note_shares">,
  note: Doc<"notes"> | null,
): note is Doc<"notes"> {
  if (!note || note.userId !== share.userId || note.trashedAt !== undefined) {
    return false;
  }
  return share.kind === "group"
    ? note.groupId !== undefined && note.groupId === share.groupId
    : (share.noteIds ?? []).includes(note._id);
}

function toSharedNote(
  note: Doc<"notes">,
  groupName: string | undefined,
): SharedNote {
  return {
    noteId: note._id,
    title: note.title,
    updatedAt: note.updatedAt,
    ...(note.status !== undefined ? { status: note.status } : {}),
    ...(note.dueDate !== undefined ? { dueDate: note.dueDate } : {}),
    ...(groupName !== undefined ? { group: groupName } : {}),
    ...(note.refCounts && hasRefs(note.refCounts)
      ? { refCounts: note.refCounts }
      : {}),
  };
}

async function groupNames(
  ctx: DbCtx,
  userId: Id<"users">,
  notes: readonly Doc<"notes">[],
): Promise<Map<Id<"note_groups">, string>> {
  const ids = [
    ...new Set(
      notes.flatMap((note) =>
        note.groupId === undefined ? [] : [note.groupId],
      ),
    ),
  ];
  const groups = await Promise.all(ids.map((id) => ctx.db.get(id)));
  return new Map(
    groups.flatMap((group) =>
      group && group.userId === userId ? [[group._id, group.name]] : [],
    ),
  );
}

function newestUpdate(share: Doc<"note_shares">, notes: Doc<"notes">[]) {
  return notes.reduce(
    (latest, note) => Math.max(latest, note.updatedAt),
    share.createdAt,
  );
}

function viewHeader(share: Doc<"note_shares">) {
  return {
    kind: share.kind,
    createdAt: share.createdAt,
    ...(share.expiresAt !== undefined ? { expiresAt: share.expiresAt } : {}),
  };
}

export async function viewShare(ctx: DbCtx, token: string): Promise<ShareView> {
  const share = await loadShare(ctx, token);
  if (!share) return null;

  if (share.kind === "group") {
    const groupId = share.groupId;
    if (groupId === undefined) return null;
    const group = await ctx.db.get(groupId);
    if (!group || group.userId !== share.userId) return null;
    const notes = await ctx.db
      .query("notes")
      .withIndex("by_userId_and_trashedAt_and_groupId_and_updatedAt", (q) =>
        q
          .eq("userId", share.userId)
          .eq("trashedAt", undefined)
          .eq("groupId", groupId),
      )
      .order("desc")
      .take(MAX_SHARE_GROUP_NOTES);
    return {
      ...viewHeader(share),
      title: share.title ?? group.name,
      group: group.name,
      updatedAt: newestUpdate(share, notes),
      total: group.noteCount,
      notes: notes.map((note) => toSharedNote(note, undefined)),
    };
  }

  const loaded = await Promise.all(
    (share.noteIds ?? []).map((noteId) => ctx.db.get(noteId)),
  );
  const notes = loaded.filter((note) => isSharedLive(share, note));
  if (notes.length === 0) return null;
  const names = await groupNames(ctx, share.userId, notes);
  const [first] = notes;
  return {
    ...viewHeader(share),
    title:
      share.title ??
      shareLabel({
        kind: share.kind,
        noteCount: notes.length,
        ...(first ? { noteTitle: first.title } : {}),
      }),
    updatedAt: newestUpdate(share, notes),
    total: notes.length,
    notes: notes.map((note) =>
      toSharedNote(
        note,
        note.groupId === undefined ? undefined : names.get(note.groupId),
      ),
    ),
  };
}

export async function shareBodies(
  ctx: DbCtx,
  token: string,
  noteIds: readonly Id<"notes">[],
): Promise<{ notes: SharedBody[]; deferred: Id<"notes">[] } | null> {
  const wanted = uniqueNoteIds(noteIds);
  if (wanted.length > SHARE_BODY_BATCH) {
    throw new Error(
      `Request at most ${String(SHARE_BODY_BATCH)} note bodies per call.`,
    );
  }
  const share = await loadShare(ctx, token);
  if (!share) return null;
  const owner = await ctx.db.get(share.userId);
  if (!owner) return null;

  const loaded = await Promise.all(wanted.map((noteId) => ctx.db.get(noteId)));
  const live = loaded.filter((note) => isSharedLive(share, note));
  const bodies: SharedBody[] = [];
  const deferred: Id<"notes">[] = [];
  let used = 0;
  for (const note of live) {
    if (deferred.length > 0) {
      deferred.push(note._id);
      continue;
    }
    const [row, refs] = await Promise.all([
      loadContentRow(ctx, note._id),
      refsForNote(ctx, owner, note._id),
    ]);
    const body: SharedBody = {
      noteId: note._id,
      content: row?.content ?? "",
      refs: refs.map(({ _id, createdAt, ...ref }) => ref),
    };
    const size = sharedBodySize(body);
    if (!bodyFits(used, size, SHARE_BODY_BYTES)) {
      deferred.push(note._id);
      continue;
    }
    bodies.push(body);
    used += size;
  }
  return { notes: bodies, deferred };
}
