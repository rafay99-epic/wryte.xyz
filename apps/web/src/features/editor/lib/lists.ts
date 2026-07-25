/**
 * Pure helpers for smart markdown list editing in the textarea:
 * Enter continues a list/quote/checkbox prefix (incrementing numbers),
 * Enter on an empty item removes the marker, and Tab/Shift+Tab
 * indent/outdent list lines. Kept free of DOM access so the behavior
 * is easy to unit-test and reuse.
 */

/**
 * Matches a list-ish line prefix: optional indent, then a checkbox item,
 * bullet, ordered item (`.` or `)` delimiter), or blockquote marker.
 */
const LIST_PREFIX_RE =
  /^(\s*)(?:([-*+]) \[(?:x|X| )\] |([-*+]) |(\d{1,9})([.)]) |(>) ?)/;

export type ListEnterAction =
  | { type: "continue"; insert: string }
  | { type: "exit"; start: number; end: number };

type LineBounds = { lineStart: number; lineEnd: number };

function lineBoundsAt(value: string, caret: number): LineBounds {
  const lineStart = value.lastIndexOf("\n", caret - 1) + 1;
  const nextBreak = value.indexOf("\n", caret);
  return { lineStart, lineEnd: nextBreak === -1 ? value.length : nextBreak };
}

/**
 * Decides what Enter should do at `caret`. Returns null when the line has
 * no list prefix (or the caret sits inside the prefix) so the caller can
 * fall through to the default newline behavior.
 */
export function listEnterAction(
  value: string,
  caret: number,
): ListEnterAction | null {
  const { lineStart, lineEnd } = lineBoundsAt(value, caret);
  const beforeCaret = value.slice(lineStart, caret);
  const match = LIST_PREFIX_RE.exec(beforeCaret);
  if (!match) return null;

  const prefixLength = match[0].length;
  if (beforeCaret.length < prefixLength) return null;

  // Empty item (nothing typed after the marker, nothing after the caret):
  // Enter exits the list by deleting the marker instead of continuing it.
  if (beforeCaret.length === prefixLength && caret === lineEnd) {
    return { type: "exit", start: lineStart, end: caret };
  }

  const indent = match[1] ?? "";
  const checkboxBullet = match[2];
  const bullet = match[3];
  const ordinal = match[4];
  const ordinalDelimiter = match[5] ?? ".";
  const quote = match[6];

  let nextPrefix: string;
  if (checkboxBullet) {
    nextPrefix = `${indent}${checkboxBullet} [ ] `;
  } else if (bullet) {
    nextPrefix = `${indent}${bullet} `;
  } else if (ordinal) {
    nextPrefix = `${indent}${Number(ordinal) + 1}${ordinalDelimiter} `;
  } else if (quote) {
    nextPrefix = `${indent}> `;
  } else {
    return null;
  }

  return { type: "continue", insert: `\n${nextPrefix}` };
}

export type ListIndentAction = {
  lineStart: number;
  /** Characters to delete at lineStart (outdent). */
  remove?: number;
  /** Text to insert at lineStart (indent). */
  insert?: string;
};

/**
 * Decides what Tab (`outdent: false`) or Shift+Tab (`outdent: true`) should
 * do on the line at `caret`. Returns null for non-list lines — and for
 * outdents with no leading whitespace — so the caller falls back to its
 * default Tab behavior.
 */
export function listIndentAction(
  value: string,
  caret: number,
  outdent: boolean,
): ListIndentAction | null {
  const { lineStart, lineEnd } = lineBoundsAt(value, caret);
  const line = value.slice(lineStart, lineEnd);
  if (!LIST_PREFIX_RE.test(line)) return null;

  if (outdent) {
    const removable = line.startsWith("  ")
      ? 2
      : line.startsWith(" ") || line.startsWith("\t")
        ? 1
        : 0;
    if (removable === 0) return null;
    return { lineStart, remove: removable };
  }
  return { lineStart, insert: "  " };
}
