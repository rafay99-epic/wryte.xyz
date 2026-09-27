import type { FrontmatterFieldType } from "@wryte/logic/types/frontmatter";

export const ARRAY_FIELD_NAMES: ReadonlySet<string> = new Set([
  "tags",
  "keywords",
  "categories",
  "topics",
  "authors",
  "aliases",
]);

export const DATE_FIELD_NAMES: ReadonlySet<string> = new Set([
  "date",
  "pubdate",
  "publishdate",
  "published",
  "publisheddate",
  "updateddate",
  "updated",
  "lastmod",
  "modified",
  "created",
  "createdat",
  "updatedat",
  "expirydate",
]);

export const BOOLEAN_FIELD_NAMES: ReadonlySet<string> = new Set([
  "draft",
  "featured",
  "hidden",
  "private",
  "sticky",
  "toc",
  "comments",
  "math",
  "unlisted",
]);

export const IMAGE_FIELD_NAME_HINTS: readonly string[] = [
  "image",
  "avatar",
  "cover",
  "thumbnail",
  "hero",
  "photo",
  "picture",
];

export const PLURAL_SCALAR_DENYLIST: ReadonlySet<string> = new Set([
  "address",
  "status",
  "synopsis",
  "rss",
  "class",
  "css",
  "canvas",
]);

export function isImageFieldName(lowerKey: string): boolean {
  if (IMAGE_FIELD_NAME_HINTS.some((hint) => lowerKey.includes(hint))) {
    return true;
  }
  return lowerKey.endsWith("pic");
}

export function typeFromFieldName(
  lowerKey: string,
): FrontmatterFieldType | null {
  if (ARRAY_FIELD_NAMES.has(lowerKey)) return "tags";
  if (BOOLEAN_FIELD_NAMES.has(lowerKey)) return "boolean";
  if (DATE_FIELD_NAMES.has(lowerKey)) return "date";
  if (lowerKey === "slug" || lowerKey === "permalink") return "slug";
  if (isImageFieldName(lowerKey)) return "image";
  return null;
}
