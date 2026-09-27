import type { FrontmatterFieldType } from "@wryte/logic/types/frontmatter";

/**
 * Field types the AI is never asked to fill — mirrored from
 * `convex/ai/enhanceActions.ts` so the drawer hides them too. The hero
 * image is uploaded; dates come from publish/schedule; slug is derived
 * from the title.
 */
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

/** Eligibility check the drawer uses to know what fields to expect. */
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
