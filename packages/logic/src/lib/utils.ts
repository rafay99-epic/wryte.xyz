import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

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
