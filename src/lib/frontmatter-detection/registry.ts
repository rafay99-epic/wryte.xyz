import type { FrontmatterFieldType } from "@/types/frontmatter";

/**
 * Name-based field hints used by type inference. A field's *name* is often a
 * stronger signal than a single sampled value — `tags: javascript` (one tag,
 * written as a scalar) is still a list field. These hints let detection type it
 * correctly regardless of the sampled value.
 *
 * NOTE: the array set mirrors `ALWAYS_ARRAY_FIELDS` in
 * `convex/_lib/frontmatter.ts` (the publish-time guard). The two live apart
 * because Convex cannot import from `src/` — keep them in sync.
 */

/** Keys that are list-valued across every framework we target. */
export const ARRAY_FIELD_NAMES: ReadonlySet<string> = new Set([
  "tags",
  "keywords",
  "categories",
  "topics",
  "authors",
  "aliases",
]);

/** Keys that represent a publish/update moment. */
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

/** Keys that are almost always booleans (flags/toggles). */
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

/** Keys whose value is an image, regardless of the sampled value's shape. */
export const IMAGE_FIELD_NAME_HINTS: readonly string[] = [
  "image",
  "avatar",
  "cover",
  "thumbnail",
  "hero",
  "photo",
  "picture",
];

/**
 * Plural-looking keys that are nonetheless scalar — kept out of the array
 * heuristic so a value like `address: "1, Main St"` is never split.
 */
export const PLURAL_SCALAR_DENYLIST: ReadonlySet<string> = new Set([
  "address",
  "status",
  "synopsis",
  "rss",
  "class",
  "css",
  "canvas",
]);

/** Returns true when `key` looks like an image field by name. */
export function isImageFieldName(lowerKey: string): boolean {
  if (IMAGE_FIELD_NAME_HINTS.some((hint) => lowerKey.includes(hint))) {
    return true;
  }
  return lowerKey.endsWith("pic");
}

/**
 * Best-effort type for a field known only by name (no value available — e.g.
 * a framework archetype that uses template placeholders). Returns null when the
 * name carries no strong signal, so the caller can fall back to value-based
 * inference.
 */
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
