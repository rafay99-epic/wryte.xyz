import type { FrontmatterFieldType } from "@/types/frontmatter";
import {
  ARRAY_FIELD_NAMES,
  BOOLEAN_FIELD_NAMES,
  DATE_FIELD_NAMES,
  isImageFieldName,
} from "./registry";

// Matches ISO 8601 dates: "2024-01-15" or "2024-01-15T10:30:00Z" etc.
const ISO_DATE_RE =
  /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})?)?$/;

/**
 * Infers a frontmatter field type from its runtime value and key name.
 *
 * Key difference from the old single-value heuristic: the *name* registry runs
 * first for list/boolean fields. A post with `tags: javascript` (a lone scalar)
 * must still type `tags` as a list — otherwise the schema records `string` and
 * every future publish emits a scalar that typed frameworks reject. This was
 * the root cause of the Astro `z.array` build failures.
 *
 * Order:
 *   1. name says array  → "tags"   (overrides a scalar sampled value)
 *   2. runtime array    → "tags"
 *   3. runtime object   → "json"
 *   4. Date instance    → date/datetime  (gray-matter yields Date for YAML dates)
 *   5. boolean/number by value
 *   6. name says boolean/date (value ambiguous/empty)
 *   7. string value heuristics (ISO date, color, image, url, slug, long → text)
 *   8. default → "string"
 */
export function inferFieldType(
  value: unknown,
  key?: string,
): FrontmatterFieldType {
  const lowerKey = key?.toLowerCase() ?? "";

  // 1. Name-based list hint wins over a single scalar sample.
  if (ARRAY_FIELD_NAMES.has(lowerKey)) return "tags";

  // 2-3. Runtime collections.
  if (Array.isArray(value)) return "tags";
  if (value instanceof Date) {
    const hasTime =
      value.getUTCHours() !== 0 ||
      value.getUTCMinutes() !== 0 ||
      value.getUTCSeconds() !== 0;
    return hasTime ? "datetime" : "date";
  }
  if (typeof value === "object" && value !== null) return "json";

  // 5. Primitive booleans/numbers.
  if (typeof value === "boolean") return "boolean";
  if (typeof value === "number") return "number";

  // 6. Name hints when the value can't disambiguate (empty / placeholder).
  if (BOOLEAN_FIELD_NAMES.has(lowerKey) && typeof value !== "string") {
    return "boolean";
  }

  if (typeof value === "string") {
    if (/^\d{4}-\d{2}-\d{2}T/.test(value)) return "datetime";
    if (ISO_DATE_RE.test(value)) return "date";
    if (/^#[0-9a-fA-F]{3,8}$/.test(value)) return "color";

    // Image-name hints before URL so cdn-hosted images stay "image".
    if (
      isImageFieldName(lowerKey) ||
      /\.(jpe?g|png|gif|webp|svg|avif)$/i.test(value)
    ) {
      return "image";
    }
    if (/^https?:\/\//i.test(value)) return "url";
    if (lowerKey === "slug" || lowerKey === "permalink") return "slug";

    // Empty value but the name screams a type.
    if (value.trim() === "") {
      if (DATE_FIELD_NAMES.has(lowerKey)) return "date";
      if (BOOLEAN_FIELD_NAMES.has(lowerKey)) return "boolean";
    }

    if (value.length >= 100) return "text";
    return "string";
  }

  // Name hints for non-string, non-primitive leftovers.
  if (DATE_FIELD_NAMES.has(lowerKey)) return "date";

  return "string";
}
