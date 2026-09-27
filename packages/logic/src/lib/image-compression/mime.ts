import type { ResolvedFormat } from "./types";

const TRANSPARENT_INPUT_MIMES = new Set([
  "image/png",
  "image/webp",
  "image/avif",
  "image/gif",
]);

const SKIP_MIMES = new Set(["image/svg+xml", "image/gif"]);

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
  }
}

export function rewriteFilename(filename: string, ext: string): string {
  const dot = filename.lastIndexOf(".");
  const base = dot > 0 ? filename.slice(0, dot) : filename;
  return `${base}.${ext}`;
}
