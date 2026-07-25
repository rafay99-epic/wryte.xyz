/**
 * Structure & SEO lint — pure, client-side content checks rendered in the
 * readability panel. Single pass over the document (plus the heading
 * outline), cheap enough to run per keystroke while the panel is open.
 * Zero backend calls.
 */

import { countWords } from "@wryte/logic/lib/word-count";
import { parseOutline } from "./outline";

export type SeoIssueSeverity = "warn" | "info";

export type SeoIssue = {
  id: string;
  severity: SeoIssueSeverity;
  message: string;
  /** Jump range when the issue maps to a document location. */
  start?: number;
  end?: number;
};

const FENCE_RE = /^(```|~~~)/;
/** `![alt](url)` with an empty/whitespace alt. */
const EMPTY_ALT_IMAGE_RE = /!\[\s*\]\(/g;
/** Markdown links that aren't images: `[text](url)`. */
const LINK_RE = /(^|[^!])\[[^\]]+\]\([^)\s]+\)/g;
const LONG_PARAGRAPH_WORDS = 150;
const LINKLESS_MIN_WORDS = 300;

export function lintStructure(content: string): SeoIssue[] {
  if (!content.trim()) return [];
  const issues: SeoIssue[] = [];

  /* ── Headings ── */
  const headings = parseOutline(content);

  const h1s = headings.filter((h) => h.level === 1);
  if (h1s.length > 1) {
    const second = h1s[1];
    issues.push({
      id: "multiple-h1",
      severity: "warn",
      message: `${h1s.length} H1 headings — most themes render the title as H1 already, so keep body headings at H2+.`,
      ...(second ? { start: second.start, end: second.end } : {}),
    });
  }

  let previous: (typeof headings)[number] | null = null;
  for (const heading of headings) {
    if (previous && heading.level > previous.level + 1) {
      issues.push({
        id: `heading-skip-${heading.start}`,
        severity: "warn",
        message: `Heading level jumps from H${previous.level} to H${heading.level} ("${heading.text}").`,
        start: heading.start,
        end: heading.end,
      });
    }
    previous = heading;
  }

  /* ── Line scan: images without alt text, fence-aware ── */
  let inFence = false;
  let offset = 0;
  let proseText = "";
  for (const line of content.split("\n")) {
    if (FENCE_RE.test(line.trimStart())) {
      inFence = !inFence;
    } else if (!inFence) {
      proseText += `${line}\n`;
      EMPTY_ALT_IMAGE_RE.lastIndex = 0;
      let match = EMPTY_ALT_IMAGE_RE.exec(line);
      while (match) {
        issues.push({
          id: `missing-alt-${offset + match.index}`,
          severity: "warn",
          message: "Image is missing alt text.",
          start: offset + match.index,
          end: offset + line.length,
        });
        match = EMPTY_ALT_IMAGE_RE.exec(line);
      }
    }
    offset += line.length + 1;
  }

  /* ── Links ── */
  const wordTotal = countWords(proseText);
  const linkCount = proseText.match(LINK_RE)?.length ?? 0;
  if (wordTotal >= LINKLESS_MIN_WORDS && linkCount === 0) {
    issues.push({
      id: "no-links",
      severity: "info",
      message: `No links in ${wordTotal.toLocaleString()} words — internal and external links help SEO and readers.`,
    });
  }

  /* ── Long paragraphs (blank-line delimited, fence-aware enough: the
        scan above already excludes fenced lines from proseText, but
        offsets must come from the original content) ── */
  let paragraphStart = 0;
  let cursor = 0;
  inFence = false;
  const flushParagraph = (endExclusive: number) => {
    const text = content.slice(paragraphStart, endExclusive);
    // Skip code fences, headings, and list blocks — long lists are fine.
    const trimmed = text.trimStart();
    if (
      !trimmed ||
      FENCE_RE.test(trimmed) ||
      trimmed.startsWith("#") ||
      trimmed.startsWith("- ") ||
      trimmed.startsWith("* ") ||
      trimmed.startsWith("> ") ||
      /^\d+[.)] /.test(trimmed)
    ) {
      return;
    }
    const count = countWords(text);
    if (count > LONG_PARAGRAPH_WORDS) {
      issues.push({
        id: `long-paragraph-${paragraphStart}`,
        severity: "info",
        message: `Paragraph with ${count} words — consider splitting it up.`,
        start: paragraphStart,
        end: endExclusive,
      });
    }
  };
  for (const line of content.split("\n")) {
    if (FENCE_RE.test(line.trimStart())) inFence = !inFence;
    if (!inFence && line.trim() === "") {
      flushParagraph(cursor);
      paragraphStart = cursor + line.length + 1;
    }
    cursor += line.length + 1;
  }
  flushParagraph(content.length);

  return issues;
}
