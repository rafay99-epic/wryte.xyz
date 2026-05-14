import type { FrontmatterFieldType } from "@/types/frontmatter";

type SchemaField = {
  name: string;
  type: FrontmatterFieldType;
  defaultValue?: string | boolean;
};

/**
 * Project-level defaults the document creator can pull from instead of
 * trusting whatever value happened to leak into the schema during
 * auto-detection. Single source of truth for "who's writing this site".
 */
export type ProjectAuthorConfig = {
  defaultAuthor?: string | undefined;
  defaultAuthorAvatar?: string | undefined;
  siteUrl?: string | undefined;
};

const DEFAULT_FIELDS: SchemaField[] = [
  { name: "title", type: "string" },
  { name: "description", type: "text" },
  { name: "tags", type: "tags" },
];

const AUTHOR_FIELD_NAMES = new Set([
  "author",
  "authorName",
  "by",
  "writer",
  "creator",
]);

const AUTHOR_AVATAR_FIELD_NAMES = new Set([
  "authorAvatar",
  "authorImage",
  "authorPic",
  "authorPhoto",
  "avatar",
]);

/**
 * Field names whose value is genuinely per-post. Auto-detection used to
 * copy these from the first scanned post, leaking them into every
 * subsequent new post's frontmatter. We refuse to pre-fill them even when
 * the schema carries a stale default — the editor presents an empty field
 * so the author has to put real content in it.
 */
const PER_POST_FIELD_NAMES = new Set([
  "excerpt",
  "summary",
  "subtitle",
  "keywords",
  "canonicalUrl",
  "canonical",
  "permalink",
  "heroImage",
  "featuredImage",
  "image",
  "cover",
  "coverImage",
  "thumbnail",
  "ogImage",
  "ogTitle",
  "ogDescription",
  "readingTime",
  "wordCount",
  "series",
  "seriesOrder",
  "featured",
]);

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
 * document. Pre-fills title and slug from the creation dialog, today's
 * date for any date/datetime fields, author + avatar from the project
 * config, and respects only configuration-like schema defaults (booleans,
 * status enums, etc.) — never per-post content like excerpt or keywords.
 */
export function buildInitialFrontmatter(
  schemaJson: string | undefined | null,
  title: string,
  slug: string,
  projectConfig?: ProjectAuthorConfig,
): string {
  const fields = parseSchema(schemaJson);
  const values: Record<string, string | boolean> = {};

  const todayDate = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const nowDatetime = new Date().toISOString().slice(0, 16); // YYYY-MM-DDTHH:MM

  for (const field of fields) {
    const name = field.name;

    if (name === "title") {
      values[name] = title;
      continue;
    }
    if (name === "slug") {
      values[name] = slug;
      continue;
    }

    if (AUTHOR_FIELD_NAMES.has(name)) {
      if (projectConfig?.defaultAuthor) {
        values[name] = projectConfig.defaultAuthor;
      }
      continue;
    }
    if (AUTHOR_AVATAR_FIELD_NAMES.has(name)) {
      if (projectConfig?.defaultAuthorAvatar) {
        values[name] = projectConfig.defaultAuthorAvatar;
      }
      continue;
    }

    if (field.type === "date") {
      values[name] = todayDate;
      continue;
    }
    if (field.type === "datetime") {
      values[name] = nowDatetime;
      continue;
    }

    if (PER_POST_FIELD_NAMES.has(name)) continue;

    if (field.defaultValue !== undefined && field.defaultValue !== "") {
      values[name] = field.defaultValue;
    }
  }

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
