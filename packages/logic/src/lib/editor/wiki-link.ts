/**
 * `[[` internal-link trigger detection (pure). Mirrors the slash trigger:
 * decides whether the caret sits in an open `[[query` context and returns
 * the query plus where the `[[` starts.
 */

export type WikiTrigger = {
  /** Index of the first `[`. Insertion replaces [queryStart, caret). */
  queryStart: number;
  /** Text typed after the `[[` (the document search filter). */
  query: string;
};

/** How far back we look for the opening `[[` — link queries are short. */
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
  // Closed/aborted contexts: another bracket or a newline ends the trigger.
  if (query.includes("]") || query.includes("[") || query.includes("\n")) {
    return null;
  }

  return { queryStart: windowStart + open, query };
}
