/**
 * Slash-command trigger detection (pure). Decides whether the caret is in an
 * active `/command` context and, if so, returns the query and where the `/`
 * started. Designed to short-circuit cheaply on the common case (no `/` token
 * at the caret) and only do the O(n) code-block scan when a real candidate
 * exists.
 */

export type SlashTrigger = {
  /** Index of the `/`. Insertion replaces [queryStart, caret). */
  queryStart: number;
  /** Text typed after the `/` (the filter). */
  query: string;
};

function isSpace(ch: string | undefined): boolean {
  return ch === " " || ch === "\t" || ch === "\n" || ch === "\r" || ch === "\f";
}

// Global regexes used with String.match (stateless — match resets lastIndex),
// so they're safe to share across calls.
const FENCE_RE = /```/g;
const BACKTICK_RE = /`/g;

/** Is `index` inside a fenced ``` block or an inline `code` span? */
function isInsideCode(text: string, index: number): boolean {
  const before = text.slice(0, index);
  const fences = before.match(FENCE_RE);
  if (fences && fences.length % 2 === 1) return true;
  const lineStart = before.lastIndexOf("\n") + 1;
  const ticks = before.slice(lineStart).match(BACKTICK_RE);
  return !!ticks && ticks.length % 2 === 1;
}

export function detectTrigger(
  text: string,
  caret: number,
): SlashTrigger | null {
  if (caret <= 0) return null;

  // Walk left over the non-whitespace run ending at the caret.
  let i = caret - 1;
  while (i >= 0 && !isSpace(text[i])) i--;
  const tokenStart = i + 1;

  // Must be a `/…` token whose `/` sits at a line start or after whitespace.
  if (text[tokenStart] !== "/") return null;
  if (tokenStart > 0 && !isSpace(text[tokenStart - 1])) return null;

  const query = text.slice(tokenStart + 1, caret);
  // A nested slash (path-like) isn't a command.
  if (query.includes("/")) return null;

  // Only now (a real `/` candidate) pay for the code-context scan.
  if (isInsideCode(text, tokenStart)) return null;

  return { queryStart: tokenStart, query };
}
