import type { FrontmatterFieldType } from "@wryte/logic/types/frontmatter";

const AI_EXCLUDED_TYPES = new Set<FrontmatterFieldType>([
  "image",
  "date",
  "datetime",
  "slug",
]);
const AI_EXCLUDED_NAMES = new Set([
  "draft",
  "pubDate",
  "publishDate",
  "date",
  "slug",
  "publishedAt",
  "updatedAt",
]);

export function isAiEligibleField(field: {
  name: string;
  type: FrontmatterFieldType;
  hidden?: boolean | undefined;
}): boolean {
  if (field.hidden) return false;
  if (AI_EXCLUDED_TYPES.has(field.type)) return false;
  if (AI_EXCLUDED_NAMES.has(field.name)) return false;
  return true;
}
