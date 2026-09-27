/**
 * Whitespace-collapsed word count — the single word counter.
 *
 * Lives in `convex/_lib/wordCount.ts` (plain TypeScript, no server imports)
 * and is re-exported here so the editor store, toolbar stats, writing sprints,
 * the publish checklist, SEO lint, and the draft compare view report the same
 * numbers as the server for the same text.
 */
export { countWords } from "@wryte/backend/_lib/wordCount";
