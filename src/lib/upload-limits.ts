/**
 * Per-project upload size limit — resolution, clamping, and formatting.
 *
 * Single source of truth used by every image upload site (insert dialog,
 * media picker, media library) and by the project settings UI. The backend
 * still enforces its own absolute cap (`QUOTAS.MAX_UPLOAD_BYTES`) in
 * `convex/media/uploads.ts`; this module just resolves the soft per-project
 * value the client checks before sending bytes over the wire.
 */

/** Default ceiling applied when a project has no explicit override. */
export const DEFAULT_MAX_UPLOAD_BYTES = 1_000_000;

/** Minimum a user can configure — prevents shooting yourself in the foot. */
export const MIN_MAX_UPLOAD_BYTES = 100_000;

/**
 * Absolute ceiling. Mirrors `QUOTAS.MAX_UPLOAD_BYTES` in
 * `convex/_lib/quotas.ts` — keep the two in sync.
 */
export const ABS_MAX_UPLOAD_BYTES = 16 * 1024 * 1024;

/** Resolve the effective limit for a project. */
export function resolveMaxUploadBytes(
  project: { maxUploadBytes?: number } | null | undefined,
): number {
  const raw = project?.maxUploadBytes;
  if (typeof raw !== "number" || !Number.isFinite(raw) || raw <= 0) {
    return DEFAULT_MAX_UPLOAD_BYTES;
  }
  return Math.min(Math.max(raw, MIN_MAX_UPLOAD_BYTES), ABS_MAX_UPLOAD_BYTES);
}

/**
 * Format a byte count as MB with a single decimal for messages and labels
 * (e.g. "1.0 MB", "2.6 MB"). Matches the wording the upload dialogs already
 * use, so swapping in this helper doesn't shift error copy.
 */
export function formatMb(bytes: number): string {
  return `${(bytes / 1_000_000).toFixed(1)} MB`;
}
