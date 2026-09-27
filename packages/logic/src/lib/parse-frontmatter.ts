export type ParsedFrontmatter = {
  tags: string[];
  category: string | null;
  author: string | null;
  [key: string]: unknown;
};

const EMPTY: ParsedFrontmatter = { tags: [], category: null, author: null };

export function parseFrontmatterJson(
  raw?: string,
  tagFieldName = "tags",
): ParsedFrontmatter {
  if (!raw) return EMPTY;

  try {
    const obj = JSON.parse(raw) as Record<string, unknown>;

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

    const rawCategory = obj["category"];
    const category =
      typeof rawCategory === "string" && rawCategory.trim()
        ? rawCategory.trim()
        : null;

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

export function parseFrontmatterSchema<T>(
  schemaJson: string | undefined | null,
  fallback: T[],
): T[] {
  if (!schemaJson) return fallback;
  try {
    const parsed = JSON.parse(schemaJson) as T[];
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : fallback;
  } catch {
    return fallback;
  }
}
