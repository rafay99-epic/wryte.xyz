import { parseFrontmatterSchema } from "@wryte/logic/lib/parse-frontmatter";
import type { FrontmatterFieldType } from "@wryte/logic/types/frontmatter";

type SchemaField = {
  name: string;
  type: FrontmatterFieldType;
  defaultValue?: string | boolean;
};

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

export function buildInitialFrontmatter(
  schemaJson: string | undefined | null,
  title: string,
  slug: string,
  projectConfig?: ProjectAuthorConfig,
): string {
  const fields = parseFrontmatterSchema(schemaJson, DEFAULT_FIELDS);
  const values: Record<string, string | boolean> = {};

  const todayDate = new Date().toISOString().slice(0, 10);
  const nowDatetime = new Date().toISOString().slice(0, 16);

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

const PUB_DATE_CANDIDATES = ["pubDate", "publishDate", "date"];

type PubDateField = { name: string; type: "date" | "datetime" };

function findPubDateField(
  schemaJson: string | undefined | null,
): PubDateField | null {
  if (!schemaJson) return null;
  try {
    const fields = JSON.parse(schemaJson) as SchemaField[];
    if (!Array.isArray(fields)) return null;

    for (const candidate of PUB_DATE_CANDIDATES) {
      for (const f of fields) {
        if (f.name !== candidate) continue;
        if (f.type === "date" || f.type === "datetime") {
          return { name: f.name, type: f.type };
        }
      }
    }
    return null;
  } catch {
    return null;
  }
}

export function findPubDateFieldName(
  schemaJson: string | undefined | null,
): string | null {
  return findPubDateField(schemaJson)?.name ?? null;
}

export function findPubDateFieldType(
  schemaJson: string | undefined | null,
): "date" | "datetime" | null {
  return findPubDateField(schemaJson)?.type ?? null;
}
