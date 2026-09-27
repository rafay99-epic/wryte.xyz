/**
 * Bounds of the blank-line-delimited paragraph containing `caret`.
 * Pure string math — used by the focus-mode paragraph overlay.
 */
export function paragraphBounds(
  value: string,
  caret: number,
): { start: number; end: number } {
  const beforeBreak = value.lastIndexOf("\n\n", Math.max(0, caret - 1));
  let start = beforeBreak === -1 ? 0 : beforeBreak + 2;
  while (start < value.length && value[start] === "\n") start++;

  const afterBreak = value.indexOf("\n\n", caret);
  const end = afterBreak === -1 ? value.length : afterBreak;

  return { start: Math.min(start, caret), end: Math.max(end, caret) };
}
