/**
 * Whitespace-collapsed word count — the single client-side word counter.
 *
 * Shared by the editor store (session baseline), the toolbar stats, writing
 * sprints, the publish checklist, SEO lint, and the draft compare view so
 * every surface reports identical numbers for the same text.
 */
export function countWords(text: string): number {
  const trimmed = text.trim();
  return trimmed ? trimmed.split(/\s+/).length : 0;
}
