import type { ResolvedFormat } from "./types";

const TRANSPARENT_INPUT_MIMES = new Set([
  "image/png",
  "image/webp",
  "image/avif",
  "image/gif",
]);

const SKIP_MIMES = new Set([
  "image/svg+xml",
  "image/gif", // animations would be flattened by Canvas; safer to skip
]);

/**
 * Returns false for MIME types the compression pipeline must not touch.
 * SVG is text, GIF is potentially animated; both are passed through as-is.
 * Unknown MIMEs that don't start with `image/` are also skipped.
 */
export function isCompressible(mime: string): boolean {
  if (!mime.startsWith("image/")) return false;
  return !SKIP_MIMES.has(mime);
}

export function hasTransparency(mime: string): boolean {
  return TRANSPARENT_INPUT_MIMES.has(mime);
}

export function mimeFromFormat(format: ResolvedFormat): string {
  switch (format) {
    case "jpeg":
      return "image/jpeg";
    case "png":
      return "image/png";
    case "webp":
      return "image/webp";
    case "avif":
      return "image/avif";
  }
}

export function extensionFromFormat(format: ResolvedFormat): string {
  switch (format) {
    case "jpeg":
      return "jpg";
    case "png":
      return "png";
    case "webp":
      return "webp";
    case "avif":
      return "avif";
  }
}

/** Replace or append an extension to a filename. */
export function rewriteFilename(filename: string, ext: string): string {
  const dot = filename.lastIndexOf(".");
  const base = dot > 0 ? filename.slice(0, dot) : filename;
  return `${base}.${ext}`;
}
