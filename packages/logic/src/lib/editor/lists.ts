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
  remove?: number;
  insert?: string;
};

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
