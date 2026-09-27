import { QUOTAS } from "@wryte/backend/_lib/quotas";

export const DEFAULT_MAX_UPLOAD_BYTES = 1_000_000;

export const MIN_MAX_UPLOAD_BYTES = 100_000;

export const ABS_MAX_UPLOAD_BYTES = QUOTAS.MAX_UPLOAD_BYTES;

export function resolveMaxUploadBytes(
  project: { maxUploadBytes?: number } | null | undefined,
): number {
  const raw = project?.maxUploadBytes;
  if (typeof raw !== "number" || !Number.isFinite(raw) || raw <= 0) {
    return DEFAULT_MAX_UPLOAD_BYTES;
  }
  return Math.min(Math.max(raw, MIN_MAX_UPLOAD_BYTES), ABS_MAX_UPLOAD_BYTES);
}

export function formatMb(bytes: number): string {
  return `${(bytes / 1_000_000).toFixed(1)} MB`;
}
