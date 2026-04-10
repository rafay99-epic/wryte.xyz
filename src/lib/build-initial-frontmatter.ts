import type { FrontmatterFieldType } from "@/types/frontmatter";

interface SchemaField {
  name: string;
  type: FrontmatterFieldType;
  defaultValue?: string | boolean;
}

const DEFAULT_FIELDS: SchemaField[] = [
  { name: "title", type: "string" },
  { name: "description", type: "text" },
  { name: "tags", type: "tags" },
];

/**
 * Parses a project's frontmatterSchema JSON string into SchemaField[].
 * Falls back to DEFAULT_FIELDS when the schema is missing or invalid.
 */
function parseSchema(schemaJson: string | undefined | null): SchemaField[] {
  if (!schemaJson) return DEFAULT_FIELDS;
  try {
    const parsed = JSON.parse(schemaJson) as SchemaField[];
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : DEFAULT_FIELDS;
  } catch {
    return DEFAULT_FIELDS;
  }
}

/**
 * Builds a JSON string of initial frontmatter values for a newly created
 * document.  Pre-fills title, slug, date fields, and schema defaults so the
 * frontmatter editor isn't empty when the user first opens it.
 */
export function buildInitialFrontmatter(
  schemaJson: string | undefined | null,
  title: string,
  slug: string,
): string {
  const fields = parseSchema(schemaJson);
  const values: Record<string, string | boolean> = {};

  const todayDate = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const nowDatetime = new Date().toISOString().slice(0, 16); // YYYY-MM-DDTHH:MM

  for (const field of fields) {
    const name = field.name;

    // Pre-fill title and slug from the creation dialog values
    if (name === "title") {
      values[name] = title;
      continue;
    }
    if (name === "slug") {
      values[name] = slug;
      continue;
    }

    // Auto-fill date-typed fields with today's date
    if (field.type === "date") {
      values[name] = todayDate;
      continue;
    }
    if (field.type === "datetime") {
      values[name] = nowDatetime;
      continue;
    }

    // Apply schema-defined defaults
    if (field.defaultValue !== undefined && field.defaultValue !== "") {
      values[name] = field.defaultValue;
    }
  }

  // Ensure title and slug are always present, even when the schema lacks them
  if (!values["title"]) values["title"] = title;
  if (!values["slug"]) values["slug"] = slug;

  return JSON.stringify(values);
}

/** Priority-ordered field names considered "publish date" fields. */
const PUB_DATE_CANDIDATES = ["pubDate", "publishDate", "date"];

/**
 * Scans a project's frontmatter schema for the publish-date field.
 * Returns the field name (e.g. "pubDate") or null when none is found.
 */
export function findPubDateFieldName(
  schemaJson: string | undefined | null,
): string | null {
  if (!schemaJson) return null;
  try {
    const fields = JSON.parse(schemaJson) as SchemaField[];
    if (!Array.isArray(fields)) return null;

    for (const candidate of PUB_DATE_CANDIDATES) {
      const match = fields.find(
        (f) =>
          f.name === candidate && (f.type === "date" || f.type === "datetime"),
      );
      if (match) return match.name;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Returns the field type for the publish-date field, or null.
 */
export function findPubDateFieldType(
  schemaJson: string | undefined | null,
): "date" | "datetime" | null {
  if (!schemaJson) return null;
  try {
    const fields = JSON.parse(schemaJson) as SchemaField[];
    if (!Array.isArray(fields)) return null;

    for (const candidate of PUB_DATE_CANDIDATES) {
      const match = fields.find(
        (f) =>
          f.name === candidate && (f.type === "date" || f.type === "datetime"),
      );
      if (match) return match.type as "date" | "datetime";
    }
    return null;
  } catch {
    return null;
  }
}
