export const QUOTAS = {
  MAX_UPLOAD_BYTES: 16 * 1024 * 1024,
  MAX_FILES_PER_PROJECT: 10_000,
  MAX_BYTES_PER_PROJECT: 5 * 1024 * 1024 * 1024,
  MAX_UPLOADS_PER_MONTH_PER_USER: 5_000,
  MAX_CREDENTIALS_PER_PROJECT: 1,
  MAX_CONCURRENT_UPLOADS_PER_USER: 3,
  ALLOWED_MIME: [
    "image/png",
    "image/jpeg",
    "image/jpg",
    "image/webp",
    "image/gif",
    "image/avif",
    "video/mp4",
    "video/webm",
    "video/quicktime",
    "video/ogg",
  ] as readonly string[],
} as const;

export function currentMonthBucket(now: number = Date.now()): string {
  const d = new Date(now);
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

export function isAllowedMime(mime: string): boolean {
  return QUOTAS.ALLOWED_MIME.includes(mime.toLowerCase());
}
