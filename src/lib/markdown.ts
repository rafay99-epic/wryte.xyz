/**
 * Converts a title string to a URL-safe slug.
 */
export function generateSlug(title: string): string {
  return title
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
      const escaped = value.replace(/"/g, '\\"');
      return `${key}: "${escaped}"`;
    }
    // Dates need ISO format for consistent parsing by static site generators
    if (value instanceof Date) {
      return `${key}: ${value.toISOString()}`;
    }
    // Arrays (e.g., tags) use YAML block sequence syntax
    if (Array.isArray(value)) {
      const items = value
        .map((item) => {
          if (typeof item === "string") {
            return `  - "${item.replace(/"/g, '\\"')}"`;
          }
          return `  - ${String(item)}`;
        })
        .join("\n");
      return `${key}:\n${items}`;
    }
    // Fallback: booleans, numbers, etc.
    return `${key}: ${String(value)}`;
  });

  return `---\n${lines.join("\n")}\n---`;
}

/**
 * Parses markdown content with YAML frontmatter.
 * Returns the frontmatter fields and the remaining body.
 */
export function parseFrontmatter(content: string): {
  frontmatter: Record<string, string>;
  body: string;
} {
  const match = content.match(/^---\s*\n([\s\S]*?)\n---\s*\n?([\s\S]*)$/);

  if (!match) {
    return { frontmatter: {}, body: content };
  }

  const [, rawFrontmatter, body] = match;
  const frontmatter: Record<string, string> = {};

  if (rawFrontmatter) {
    for (const line of rawFrontmatter.split("\n")) {
      const colonIndex = line.indexOf(":");
      if (colonIndex === -1) continue;

      const key = line.slice(0, colonIndex).trim();
      let value = line.slice(colonIndex + 1).trim();

      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }

      if (key) {
        frontmatter[key] = value;
      }
    }
  }

  return { frontmatter, body: body ?? "" };
}

/**
 * Combines frontmatter fields and body into a full markdown document.
 */
export function buildFullDocument(
  frontmatter: Record<string, unknown>,
  body: string,
): string {
  const fm = buildFrontmatter(frontmatter);
  return `${fm}\n\n${body}`;
}
