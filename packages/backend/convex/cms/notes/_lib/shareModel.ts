import { type Infer, v } from "convex/values";
import {
  noteByteLength,
  noteStatusValidator,
  refCountsValidator,
  refInputValidator,
} from "./model";

export const MAX_SHARE_NOTES = 50;
export const MAX_SHARE_GROUP_NOTES = 200;
export const MAX_SHARE_TITLE_LENGTH = 120;
export const SHARE_BODY_BATCH = 10;
export const SHARE_BODY_BYTES = 512 * 1024;
export const SHARE_LIST_LIMIT = 100;
export const SHARE_TOKEN_BYTES = 32;
const DAY_MS = 86_400_000;
const SHARE_TOKEN_RE = /^[A-Za-z0-9_-]{43}$/;

export const shareKindValidator = v.union(
  v.literal("note"),
  v.literal("notes"),
  v.literal("group"),
);
export type ShareKind = Infer<typeof shareKindValidator>;

export const shareExpiryValidator = v.union(
  v.literal(1),
  v.literal(7),
  v.literal(30),
);
export type ShareExpiryDays = Infer<typeof shareExpiryValidator>;

export const shareCreatedValidator = v.object({
  shareId: v.id("note_shares"),
  token: v.string(),
  expiresAt: v.optional(v.number()),
});
export type ShareCreated = Infer<typeof shareCreatedValidator>;

export const shareRowValidator = v.object({
  shareId: v.id("note_shares"),
  token: v.string(),
  kind: shareKindValidator,
  label: v.string(),
  title: v.optional(v.string()),
  noteIds: v.optional(v.array(v.id("notes"))),
  groupId: v.optional(v.id("note_groups")),
  noteCount: v.number(),
  createdAt: v.number(),
  expiresAt: v.optional(v.number()),
});
export type ShareRow = Infer<typeof shareRowValidator>;

export const sharedNoteValidator = v.object({
  noteId: v.id("notes"),
  title: v.string(),
  status: v.optional(noteStatusValidator),
  dueDate: v.optional(v.string()),
  group: v.optional(v.string()),
  refCounts: v.optional(refCountsValidator),
  updatedAt: v.number(),
});
export type SharedNote = Infer<typeof sharedNoteValidator>;

export const shareViewValidator = v.union(
  v.null(),
  v.object({
    kind: shareKindValidator,
    title: v.string(),
    group: v.optional(v.string()),
    createdAt: v.number(),
    expiresAt: v.optional(v.number()),
    updatedAt: v.number(),
    total: v.number(),
    notes: v.array(sharedNoteValidator),
  }),
);
export type ShareView = Infer<typeof shareViewValidator>;

export const sharedBodyValidator = v.object({
  noteId: v.id("notes"),
  content: v.string(),
  refs: v.array(refInputValidator),
});
export type SharedBody = Infer<typeof sharedBodyValidator>;

export const shareBodiesValidator = v.union(
  v.null(),
  v.object({
    notes: v.array(sharedBodyValidator),
    deferred: v.array(v.id("notes")),
  }),
);

export function isShareToken(token: string): boolean {
  return SHARE_TOKEN_RE.test(token);
}

export function newShareToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(SHARE_TOKEN_BYTES));
  return btoa(String.fromCharCode(...bytes))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/, "");
}

export function shareExpiresAt(
  now: number,
  days: ShareExpiryDays | undefined,
): number | undefined {
  return days === undefined ? undefined : now + days * DAY_MS;
}

export function normalizeShareTitle(
  title: string | undefined,
): string | undefined {
  const trimmed = title?.trim();
  if (!trimmed) return undefined;
  if (trimmed.length > MAX_SHARE_TITLE_LENGTH) {
    throw new Error(
      `Share title must be ${String(MAX_SHARE_TITLE_LENGTH)} characters or fewer.`,
    );
  }
  return trimmed;
}

export function shareLabel(share: {
  kind: ShareKind;
  noteCount: number;
  noteTitle?: string;
  groupName?: string;
}): string {
  switch (share.kind) {
    case "note":
      return share.noteTitle?.trim() || "Untitled note";
    case "notes":
      return `${String(share.noteCount)} ${share.noteCount === 1 ? "note" : "notes"}`;
    case "group":
      return share.groupName ?? "Deleted group";
  }
}

export function sharedBodySize(
  body: Pick<SharedBody, "content" | "refs">,
): number {
  return (
    noteByteLength(body.content) + noteByteLength(JSON.stringify(body.refs))
  );
}

export function bodyFits(used: number, size: number, cap: number): boolean {
  return used === 0 || used + size <= cap;
}
