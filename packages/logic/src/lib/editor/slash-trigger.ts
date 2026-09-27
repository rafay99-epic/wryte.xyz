export type SlashTrigger = {
  queryStart: number;
  query: string;
};

function isSpace(ch: string | undefined): boolean {
  return ch === " " || ch === "\t" || ch === "\n" || ch === "\r" || ch === "\f";
}

const FENCE_RE = /```/g;
const BACKTICK_RE = /`/g;

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

  let i = caret - 1;
  while (i >= 0 && !isSpace(text[i])) i--;
  const tokenStart = i + 1;

  if (text[tokenStart] !== "/") return null;
  if (tokenStart > 0 && !isSpace(text[tokenStart - 1])) return null;

  const query = text.slice(tokenStart + 1, caret);
  if (query.includes("/")) return null;

  if (isInsideCode(text, tokenStart)) return null;

  return { queryStart: tokenStart, query };
}
