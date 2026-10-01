export type BodyRevision = { rev: number; writer?: string };

export type BodySnapshot = { content: string; rev: number };

export function isExternalRevision(
  meta: BodyRevision,
  baseline: number,
  sessionId: string,
): boolean {
  return meta.rev > baseline && meta.writer !== sessionId;
}

export function currentRevision(
  meta: BodyRevision | null | undefined,
  baseline: number,
  sessionId: string,
): number {
  return meta && meta.rev > baseline && meta.writer === sessionId
    ? meta.rev
    : baseline;
}
