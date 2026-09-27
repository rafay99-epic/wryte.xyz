import type { FrontmatterFieldType } from "@wryte/logic/types/frontmatter";
import {
  ARRAY_FIELD_NAMES,
  BOOLEAN_FIELD_NAMES,
  DATE_FIELD_NAMES,
  isImageFieldName,
} from "./registry";

const ISO_DATE_RE =
  /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})?)?$/;

export function inferFieldType(
  value: unknown,
  key?: string,
): FrontmatterFieldType {
  const lowerKey = key?.toLowerCase() ?? "";

  if (ARRAY_FIELD_NAMES.has(lowerKey)) return "tags";

  if (Array.isArray(value)) return "tags";
  if (value instanceof Date) {
    const hasTime =
      value.getUTCHours() !== 0 ||
      value.getUTCMinutes() !== 0 ||
      value.getUTCSeconds() !== 0;
    return hasTime ? "datetime" : "date";
  }
  if (typeof value === "object" && value !== null) return "json";

  if (typeof value === "boolean") return "boolean";
  if (typeof value === "number") return "number";

  if (BOOLEAN_FIELD_NAMES.has(lowerKey) && typeof value !== "string") {
    return "boolean";
  }

  if (typeof value === "string") {
    if (/^\d{4}-\d{2}-\d{2}T/.test(value)) return "datetime";
    if (ISO_DATE_RE.test(value)) return "date";
    if (/^#[0-9a-fA-F]{3,8}$/.test(value)) return "color";

    if (
      isImageFieldName(lowerKey) ||
      /\.(jpe?g|png|gif|webp|svg|avif)$/i.test(value)
    ) {
      return "image";
    }
    if (/^https?:\/\//i.test(value)) return "url";
    if (lowerKey === "slug" || lowerKey === "permalink") return "slug";

    if (value.trim() === "") {
      if (DATE_FIELD_NAMES.has(lowerKey)) return "date";
      if (BOOLEAN_FIELD_NAMES.has(lowerKey)) return "boolean";
    }

    if (value.length >= 100) return "text";
    return "string";
  }

  if (DATE_FIELD_NAMES.has(lowerKey)) return "date";

  return "string";
}
