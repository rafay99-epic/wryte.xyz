import type { Id } from "@wryte/backend/_generated/dataModel";
import {
  isShareToken,
  SHARE_BODY_BATCH,
  type ShareExpiryDays,
  type ShareRow,
} from "@wryte/backend/cms/notes/_lib/shareModel";

export const SHARED_PATH = "/shared";

export type ShareTarget =
  | { kind: "note"; noteId: Id<"notes">; label: string }
  | { kind: "notes"; noteIds: readonly Id<"notes">[]; label: string }
  | { kind: "group"; groupId: Id<"note_groups">; label: string };

export const SHARE_EXPIRY_CHOICES = ["1", "7", "30", "never"] as const;

export type ShareExpiryChoice = (typeof SHARE_EXPIRY_CHOICES)[number];

export const SHARE_EXPIRY_LABELS: Record<ShareExpiryChoice, string> = {
  "1": "1 day",
  "7": "7 days",
  "30": "30 days",
  never: "Never",
};

const EXPIRY_DAYS: Record<ShareExpiryChoice, ShareExpiryDays | undefined> = {
  "1": 1,
  "7": 7,
  "30": 30,
  never: undefined,
};

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

export function isShareExpiryChoice(value: string): value is ShareExpiryChoice {
  return SHARE_EXPIRY_CHOICES.some((choice) => choice === value);
}

export function shareCreateArgs(
  target: ShareTarget,
  title: string,
  expiry: ShareExpiryChoice,
) {
  const trimmed = title.trim();
  const days = EXPIRY_DAYS[expiry];
  return {
    kind: target.kind,
    ...(target.kind === "note" ? { noteIds: [target.noteId] } : {}),
    ...(target.kind === "notes" ? { noteIds: [...target.noteIds] } : {}),
    ...(target.kind === "group" ? { groupId: target.groupId } : {}),
    ...(trimmed ? { title: trimmed } : {}),
    ...(days !== undefined ? { expiresInDays: days } : {}),
  };
}

export function sharesForTarget(
  shares: readonly ShareRow[],
  target: ShareTarget,
): ShareRow[] {
  switch (target.kind) {
    case "note":
      return shares.filter(
        (share) =>
          share.kind === "note" && share.noteIds?.[0] === target.noteId,
      );
    case "notes":
      return [];
    case "group":
      return shares.filter(
        (share) => share.kind === "group" && share.groupId === target.groupId,
      );
  }
}

export function shareTokenFromHash(hash: string): string | null {
  const token = hash.startsWith("#") ? hash.slice(1) : hash;
  return isShareToken(token) ? token : null;
}

export function shareUrl(origin: string, token: string): string {
  return `${origin}${SHARED_PATH}#${token}`;
}

export function bodyBatch<T>(
  ids: readonly T[],
  from: number,
  requested: ReadonlySet<T>,
  size: number = SHARE_BODY_BATCH,
): T[] {
  const first = ids[from];
  if (first === undefined || requested.has(first)) return [];
  return ids.slice(from, from + size).filter((id) => !requested.has(id));
}

export function shareExpiryLabel(
  expiresAt: number | undefined,
  now: number,
): string {
  if (expiresAt === undefined) return "No expiry";
  const left = expiresAt - now;
  if (left <= 0) return "Expired";
  if (left < DAY_MS) return `Expires in ${String(Math.ceil(left / HOUR_MS))}h`;
  return `Expires in ${String(Math.ceil(left / DAY_MS))}d`;
}

export function sharedNoteAnchor(noteId: string): string {
  return `shared-note-${noteId}`;
}

export function noteCountLabel(count: number): string {
  return count === 1 ? "1 note" : `${String(count)} notes`;
}
