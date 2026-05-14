import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Merges CSS class names with Tailwind CSS conflict resolution.
 *
 * Combines clsx (conditional class joining) with tailwind-merge (deduplicates
 * and resolves conflicting Tailwind utilities, e.g., "px-2 px-4" -> "px-4").
 * This is the standard pattern for components that accept a className prop
 * alongside internal Tailwind classes.
 *
 * @example cn("px-2 py-1", isActive && "bg-blue-500", className)
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Acronyms that should stay fully uppercase when a field name is humanised.
 * Add to this list rather than hard-coding capitalisation logic.
 */
const FIELD_LABEL_ACRONYMS = new Set([
  "url",
  "uri",
  "id",
  "api",
  "css",
  "html",
  "json",
  "yaml",
  "seo",
  "og",
  "rss",
  "ai",
  "ui",
  "ux",
  "ip",
  "gpu",
  "cpu",
  "pdf",
  "svg",
]);

/**
 * Converts a frontmatter field key (camelCase, snake_case, kebab-case) into a
 * human-readable label. The editor falls back to this whenever a field has no
 * explicit `label` set, so `pubDate` renders as "Pub Date" and `canonicalUrl`
 * as "Canonical URL" instead of the raw key.
 */
export function humanizeFieldName(name: string): string {
  if (!name) return "";
  const spaced = name
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/([A-Z])([A-Z][a-z])/g, "$1 $2")
    .replace(/[-_]+/g, " ")
    .trim();
  return spaced
    .split(/\s+/)
    .map((word) => {
      const lower = word.toLowerCase();
      if (FIELD_LABEL_ACRONYMS.has(lower)) return lower.toUpperCase();
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(" ");
}
