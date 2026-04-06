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
 */
export function buildFrontmatter(fields: Record<string, unknown>): string {
  const lines = Object.entries(fields).map(([key, value]) => {
    if (typeof value === "string") {
      const escaped = value.replace(/"/g, '\\"');
      return `${key}: "${escaped}"`;
    }
    if (value instanceof Date) {
      return `${key}: ${value.toISOString()}`;
    }
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
