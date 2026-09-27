/**
 * Converts a title string to a URL-safe slug.
 * Handles unicode by decomposing accented characters (e.g. "é" → "e")
 * via NFD normalization before stripping combining diacritical marks.
 */
export function generateSlug(title: string): string {
  return title
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}
