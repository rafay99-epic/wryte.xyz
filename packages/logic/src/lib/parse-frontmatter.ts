/**
 * Safe JSON parser for document frontmatter stored in Convex.
 *
 * Documents store frontmatter as a JSON string (not raw YAML).
 * This utility extracts structured metadata like tags, category, and author
 * with graceful fallbacks for missing or malformed data.
 */

export type ParsedFrontmatter = {
  tags: string[];
  category: string | null;
  author: string | null;
  [key: string]: unknown;
};

const EMPTY: ParsedFrontmatter = { tags: [], category: null, author: null };

/**
 * Parse the JSON frontmatter string stored on a document.
 *
 * Handles:
 * - Missing or undefined input
 * - Invalid JSON (returns safe defaults)
 * - Tags as string[] or comma-separated string
 * - Optional schema-aware tag field lookup
 */
export function parseFrontmatterJson(
  raw?: string,
  tagFieldName = "tags",
): ParsedFrontmatter {
  if (!raw) return EMPTY;

  try {
    const obj = JSON.parse(raw) as Record<string, unknown>;

    // Extract tags — support both array and comma-separated string
    const rawTags = obj[tagFieldName] ?? obj["tags"] ?? obj["keywords"];
    let tags: string[] = [];
    if (Array.isArray(rawTags)) {
      tags = rawTags
        .filter((t): t is string => typeof t === "string")
        .map((t) => t.trim())
        .filter(Boolean);
    } else if (typeof rawTags === "string" && rawTags.trim()) {
      tags = rawTags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);
    }

    // Extract category
    const rawCategory = obj["category"];
    const category =
      typeof rawCategory === "string" && rawCategory.trim()
        ? rawCategory.trim()
        : null;

    // Extract author
    const rawAuthor = obj["author"];
    const author =
      typeof rawAuthor === "string" && rawAuthor.trim()
        ? rawAuthor.trim()
        : null;

    return { ...obj, tags, category, author };
  } catch {
    return EMPTY;
  }
}

/**
 * Find the field name used for tags in a project's frontmatter schema.
 * The schema is stored as a JSON string of FrontmatterField[].
 * Returns the name of the first field with type "tags", or "tags" as default.
 */
export function getTagFieldName(schemaJson?: string): string {
  if (!schemaJson) return "tags";
  try {
    const fields = JSON.parse(schemaJson) as Array<{
      name: string;
      type: string;
    }>;
    const tagField = fields.find((f) => f.type === "tags");
    return tagField?.name ?? "tags";
  } catch {
    return "tags";
  }
}
