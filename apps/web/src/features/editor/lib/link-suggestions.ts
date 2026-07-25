/**
 * Internal-link suggestion scanner — pure functions over content the editor
 * already holds. Finds unlinked mentions of other documents' titles so the
 * research panel can offer one-click wiki-linking.
 */
import { stripForAnalysis } from "@/features/editor/lib/style-lint";

export type LinkTargetDoc = {
  _id: string;
  title: string;
  slug: string;
};

export type LinkSuggestion = {
  docId: string;
  title: string;
  slug: string;
  /** Char offsets of the first unlinked mention in the ORIGINAL content. */
  start: number;
  end: number;
  /** The mention exactly as it appears in the prose (original casing). */
  matched: string;
};

/** Titles shorter than this match too much prose to be useful. */
const MIN_TITLE_LENGTH = 4;
const MAX_SUGGESTIONS = 10;

/** True when the char is a word constituent (letter, digit, _ or -). */
function isWordChar(ch: string | undefined): boolean {
  if (!ch) return false;
  return /[\p{L}\p{N}_-]/u.test(ch);
}

/**
 * Masks spans that are already links so their text can't be re-suggested:
 * `[[wiki links]]` (with optional label) and `[label](url)` markdown links.
 * Space-masked like `stripForAnalysis`, so offsets stay aligned.
 */
function maskExistingLinks(text: string): string {
  return text
    .replace(/\[\[[^\]\n]*\]\]/g, (m) => " ".repeat(m.length))
    .replace(/\[[^\]\n]*\]\([^)\n]*\)/g, (m) => " ".repeat(m.length));
}

/**
 * Find the first whole-word, case-insensitive occurrence of `needle` in
 * `haystack`, starting the boundary check outside masked regions.
 */
function findWholeWord(haystack: string, needle: string): number {
  const lowerHaystack = haystack.toLowerCase();
  const lowerNeedle = needle.toLowerCase();
  let from = 0;
  while (from <= lowerHaystack.length - lowerNeedle.length) {
    const idx = lowerHaystack.indexOf(lowerNeedle, from);
    if (idx === -1) return -1;
    const before = haystack[idx - 1];
    const after = haystack[idx + needle.length];
    if (!isWordChar(before) && !isWordChar(after)) return idx;
    from = idx + 1;
  }
  return -1;
}

/**
 * Scan `content` for unlinked mentions of other documents. Returns at most
 * one suggestion per target document (its first mention), ordered by
 * position, capped at MAX_SUGGESTIONS.
 */
export function findLinkSuggestions(
  content: string,
  docs: LinkTargetDoc[],
  currentDocId: string,
): LinkSuggestion[] {
  if (!content.trim() || docs.length === 0) return [];

  // Mask frontmatter/code/URLs (style-lint's masking preserves offsets),
  // then mask spans that are already links.
  const masked = maskExistingLinks(stripForAnalysis(content));
  const lowerContent = content.toLowerCase();

  const suggestions: LinkSuggestion[] = [];
  for (const doc of docs) {
    if (doc._id === currentDocId) continue;
    const title = doc.title.trim();
    if (title.length < MIN_TITLE_LENGTH) continue;

    // Skip docs this article already links to — a `[[title` wiki link or a
    // `](/slug)` markdown link anywhere in the ORIGINAL content counts.
    if (lowerContent.includes(`[[${title.toLowerCase()}`)) continue;
    if (doc.slug && lowerContent.includes(`](/${doc.slug.toLowerCase()})`)) {
      continue;
    }

    const idx = findWholeWord(masked, title);
    if (idx === -1) continue;

    suggestions.push({
      docId: doc._id,
      title: doc.title,
      slug: doc.slug,
      start: idx,
      end: idx + title.length,
      matched: content.slice(idx, idx + title.length),
    });
  }

  return suggestions
    .sort((a, b) => a.start - b.start)
    .slice(0, MAX_SUGGESTIONS);
}
