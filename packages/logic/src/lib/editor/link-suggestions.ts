import { stripForAnalysis } from "@wryte/logic/lib/editor/style-lint";

export type LinkTargetDoc = {
  _id: string;
  title: string;
  slug: string;
};

export type LinkSuggestion = {
  docId: string;
  title: string;
  slug: string;
  start: number;
  end: number;
  matched: string;
};

const MIN_TITLE_LENGTH = 4;
const MAX_SUGGESTIONS = 10;

function isWordChar(ch: string | undefined): boolean {
  if (!ch) return false;
  return /[\p{L}\p{N}_-]/u.test(ch);
}

function maskExistingLinks(text: string): string {
  return text
    .replace(/\[\[[^\]\n]*\]\]/g, (m) => " ".repeat(m.length))
    .replace(/\[[^\]\n]*\]\([^)\n]*\)/g, (m) => " ".repeat(m.length));
}

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

export function findLinkSuggestions(
  content: string,
  docs: LinkTargetDoc[],
  currentDocId: string,
): LinkSuggestion[] {
  if (!content.trim() || docs.length === 0) return [];

  const masked = maskExistingLinks(stripForAnalysis(content));
  const lowerContent = content.toLowerCase();

  const suggestions: LinkSuggestion[] = [];
  for (const doc of docs) {
    if (doc._id === currentDocId) continue;
    const title = doc.title.trim();
    if (title.length < MIN_TITLE_LENGTH) continue;

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
