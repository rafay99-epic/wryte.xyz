export type WikiTrigger = {
  queryStart: number;
  query: string;
};

const MAX_LOOKBACK = 80;

export function detectWikiTrigger(
  text: string,
  caret: number,
): WikiTrigger | null {
  if (caret < 2) return null;

  const windowStart = Math.max(0, caret - MAX_LOOKBACK);
  const before = text.slice(windowStart, caret);
  const open = before.lastIndexOf("[[");
  if (open === -1) return null;

  const query = before.slice(open + 2);
  if (query.includes("]") || query.includes("[") || query.includes("\n")) {
    return null;
  }

  return { queryStart: windowStart + open, query };
}
