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

/**
 * Generates a YAML frontmatter block from a record of fields.
 *
 * Handles type-specific serialization:
 * - Strings are double-quoted with escaped inner quotes.
 * - Dates are serialized to ISO 8601 format.
 * - Arrays are rendered as YAML list syntax (one `- item` per line).
 * - All other types are coerced to strings via String().
 *
 * The result is wrapped in `---` delimiters, ready to prepend to markdown content.
 *
 * @param fields - Key-value pairs representing frontmatter metadata.
 * @returns A complete YAML frontmatter block string (e.g., "---\ntitle: \"Hello\"\n---").
 */
export function buildFrontmatter(fields: Record<string, unknown>): string {
  const lines = Object.entries(fields).map(([key, value]) => {
    // Wrap strings in double quotes, escaping any inner quotes
    if (typeof value === "string") {
      return `${key}: "${value.replace(/"/g, '\\"')}"`;
    }
    // ISO-format Date objects
    if (value instanceof Date) {
      return `${key}: "${value.toISOString()}"`;
    }
    // Render arrays as YAML list
    if (Array.isArray(value)) {
      if (value.length === 0) return `${key}: []`;
      const items = value.map((item) => `  - "${String(item)}"`).join("\n");
      return `${key}:\n${items}`;
    }
    // Booleans, numbers, and other types
    return `${key}: ${String(value)}`;
  });

  return `---\n${lines.join("\n")}\n---`;
}
