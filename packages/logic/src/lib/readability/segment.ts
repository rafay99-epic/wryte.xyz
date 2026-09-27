/**
 * Markdown-aware text segmentation (pure). Produces character-offset ranges for
 * words and sentences so they map straight onto the editor's textarea string.
 *
 * Code is excluded from analysis: fenced ``` blocks ``` and inline `code` are
 * masked to spaces (newlines preserved) before tokenizing, so terminators and
 * words inside code never count.
 */

export type CodeRange = { start: number; end: number };
export type WordToken = { start: number; end: number; text: string };
export type SentenceRange = { start: number; end: number };

function isSpace(ch: string | undefined): boolean {
  return ch === " " || ch === "\t" || ch === "\n" || ch === "\r" || ch === "\f";
}

/** Fenced + inline code spans, sorted by start. */
export function findCodeRanges(text: string): CodeRange[] {
  const ranges: CodeRange[] = [];
  const fence = /```[\s\S]*?```/g;
  let m: RegExpExecArray | null;
  m = fence.exec(text);
  while (m !== null) {
    ranges.push({ start: m.index, end: m.index + m[0].length });
    m = fence.exec(text);
  }
  const inline = /`[^`\n]+`/g;
  m = inline.exec(text);
  while (m !== null) {
    const start = m.index;
    const inFence = ranges.some((r) => start >= r.start && start < r.end);
    if (!inFence) ranges.push({ start, end: start + m[0].length });
    m = inline.exec(text);
  }
  ranges.sort((a, b) => a.start - b.start);
  return ranges;
}

/** Replace code chars with spaces (keep newlines) so indices are preserved. */
export function maskCode(text: string, ranges: CodeRange[]): string {
  if (ranges.length === 0) return text;
  const arr = text.split("");
  for (const r of ranges) {
    for (let i = r.start; i < r.end && i < arr.length; i++) {
      if (arr[i] !== "\n") arr[i] = " ";
    }
  }
  return arr.join("");
}

export function tokenizeWords(masked: string): WordToken[] {
  const out: WordToken[] = [];
  const re = /[\p{L}][\p{L}\p{M}'’-]*/gu;
  let m: RegExpExecArray | null = re.exec(masked);
  while (m !== null) {
    out.push({ start: m.index, end: m.index + m[0].length, text: m[0] });
    m = re.exec(masked);
  }
  return out;
}

const SENTENCE_START = /[A-Z0-9"'’“([#>\-*]/;
const CLOSING_PUNCT = /["'’”)\]]/;
const PARAGRAPH_SPLIT = /\n\s*\n/;
const HAS_WORD = /[\p{L}\p{N}]/u;

/**
 * Split into sentences over the masked text. A terminator (`.!?`) ends a
 * sentence only when followed by whitespace/EOL and the next non-space char
 * looks like a new sentence start (uppercase, digit, quote, or markdown line
 * marker) — this naturally skips abbreviations ("e.g. the") and decimals
 * ("3.14") without an abbreviation list. Blank lines also end a sentence.
 */
export function splitSentences(masked: string): SentenceRange[] {
  const sentences: SentenceRange[] = [];
  const n = masked.length;

  const push = (rawStart: number, rawEnd: number) => {
    let s = rawStart;
    let e = rawEnd;
    while (s < e && isSpace(masked[s])) s++;
    while (e > s && isSpace(masked[e - 1])) e--;
    if (e > s) sentences.push({ start: s, end: e });
  };

  let start = 0;
  let i = 0;
  while (i < n) {
    const ch = masked[i];

    if (ch === "." || ch === "!" || ch === "?") {
      let j = i + 1;
      while (
        j < n &&
        (masked[j] === "." || masked[j] === "!" || masked[j] === "?")
      )
        j++;
      while (j < n && CLOSING_PUNCT.test(masked[j] ?? "")) j++;
      if (j >= n || isSpace(masked[j])) {
        let k = j;
        while (k < n && isSpace(masked[k])) k++;
        if (k >= n || SENTENCE_START.test(masked[k] ?? "")) {
          push(start, j);
          start = k;
          i = k;
          continue;
        }
      }
      i = j;
      continue;
    }

    if (ch === "\n") {
      let j = i + 1;
      while (
        j < n &&
        (masked[j] === " " || masked[j] === "\t" || masked[j] === "\r")
      )
        j++;
      if (j < n && masked[j] === "\n") {
        push(start, i);
        let k = j;
        while (k < n && isSpace(masked[k])) k++;
        start = k;
        i = k;
        continue;
      }
    }

    i++;
  }
  push(start, n);
  return sentences;
}

/** Count paragraphs = blank-line-separated blocks that contain a word. */
export function countParagraphs(masked: string): number {
  const blocks = masked.split(PARAGRAPH_SPLIT);
  let count = 0;
  for (const block of blocks) {
    if (HAS_WORD.test(block)) count++;
  }
  return count;
}
