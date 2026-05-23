/**
 * Centralized media quotas. Surface these in the UI when relevant so users
 * know what they're up against before they hit a limit. Adjust in one place.
 */

export const QUOTAS = {
  /** Convex action arg cap — hard upper bound on a single upload. */
  MAX_UPLOAD_BYTES: 16 * 1024 * 1024,
  /** Soft ceiling on files per project; rejects further uploads. */
  MAX_FILES_PER_PROJECT: 10_000,
  /** Soft ceiling on aggregate bytes per project. */
  MAX_BYTES_PER_PROJECT: 5 * 1024 * 1024 * 1024,
  /** Per-user monthly upload count, signals suspected abuse. */
  MAX_UPLOADS_PER_MONTH_PER_USER: 5_000,
  /** One active credential per provider per project. */
  MAX_CREDENTIALS_PER_PROJECT: 1,
  /** Soft cap enforced by the upload rate limiter (uploads:concurrency). */
  MAX_CONCURRENT_UPLOADS_PER_USER: 3,
  /**
   * Closed-list of accepted MIME types — rejects anything else early.
   *
   * SVGs are deliberately excluded: the XML grammar admits inline `<script>`
   * and event handlers, so uploading one and then opening its hosted URL in
   * the user's browser would execute arbitrary JS in the hosting origin.
   * If we ever need vector support, route it through a server-side
   * sanitiser (e.g. DOMPurify with the SVG profile) before persisting.
   */
  ALLOWED_MIME: [
    "image/png",
    "image/jpeg",
    "image/jpg",
    "image/webp",
    "image/gif",
    "image/avif",
  ] as readonly string[],
} as const;

/**
 * Returns the YYYY-MM bucket for the current Date.now(). Used to roll
 * uploads-per-month counters without scheduled resets.
 */
export function currentMonthBucket(now: number = Date.now()): string {
  const d = new Date(now);
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

export function isAllowedMime(mime: string): boolean {
  return QUOTAS.ALLOWED_MIME.includes(mime.toLowerCase());
}
