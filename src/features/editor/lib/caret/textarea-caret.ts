/**
 * Measures the pixel position of a caret/character index inside a `<textarea>`.
 *
 * A textarea exposes no API for "where is character N on screen", so we build an
 * ephemeral hidden `<div>` whose box model and text wrapping are copied from the
 * live textarea, slice the value up to `index`, drop a marker span there, and
 * read its offset. The mirror is created, measured, and torn down per call — no
 * persistent DOM, no leaks.
 *
 * Returned coordinates are relative to the textarea's border-box top-left and
 * account for the textarea's own scroll offset, so a consumer adds
 * `textarea.getBoundingClientRect()` for viewport coords.
 *
 * Shared by the slash menu (position the popover at the caret) and the
 * readability panel's jump-to-sentence scroll.
 */

// Style properties that affect text layout and therefore must be mirrored
// exactly, or the measured position drifts from the real caret. NOTE: `width`
// and `boxSizing` are set explicitly below (from clientWidth + border-box) —
// copying `getComputedStyle().width` is unsafe because it returns the
// content-box width, which combined with border-box + padding narrows the
// mirror's text column and wraps text into extra lines.
const MIRRORED_PROPERTIES = [
  "paddingTop",
  "paddingRight",
  "paddingBottom",
  "paddingLeft",
  "borderTopWidth",
  "borderRightWidth",
  "borderBottomWidth",
  "borderLeftWidth",
  "fontFamily",
  "fontSize",
  "fontWeight",
  "fontStyle",
  "fontVariant",
  "fontStretch",
  "letterSpacing",
  "lineHeight",
  "textAlign",
  "textTransform",
  "textIndent",
  "tabSize",
  "wordSpacing",
  "whiteSpace",
  "overflowWrap",
  "wordBreak",
] as const;

export type CaretRect = {
  /** Pixels from the textarea's border-box top to the top of the caret line. */
  top: number;
  /** Pixels from the textarea's border-box left to the caret. */
  left: number;
  /** Line height in pixels (height of the caret). */
  height: number;
};

export function caretRect(
  textarea: HTMLTextAreaElement,
  index: number,
): CaretRect | null {
  if (typeof document === "undefined") return null;

  const computed = window.getComputedStyle(textarea);
  const mirror = document.createElement("div");
  const style = mirror.style;

  // Off-screen, non-interactive, wraps exactly like the textarea.
  style.position = "absolute";
  style.top = "0";
  style.left = "-9999px";
  style.visibility = "hidden";
  style.whiteSpace = "pre-wrap";
  style.wordWrap = "break-word";
  style.overflow = "hidden";

  for (const prop of MIRRORED_PROPERTIES) {
    style[prop] = computed[prop];
  }
  // Match the textarea's text column exactly. `clientWidth` is content+padding
  // and already excludes any scrollbar; with border-box + the copied padding,
  // the mirror's content width equals the textarea's, so wrapping is identical.
  style.boxSizing = "border-box";
  style.width = `${textarea.clientWidth}px`;

  const value = textarea.value;
  // Text before the caret, with a guaranteed final char so trailing spaces and
  // newlines are measured (textContent collapses a lone trailing newline).
  mirror.textContent = value.slice(0, Math.max(0, index));

  const marker = document.createElement("span");
  // A zero-width marker would have no offset on an empty line; use a visible
  // glyph and read its top-left.
  marker.textContent = value.slice(index, index + 1) || ".";
  mirror.appendChild(marker);

  document.body.appendChild(mirror);
  const lineHeight =
    Number.parseFloat(computed.lineHeight) ||
    Number.parseFloat(computed.fontSize) * 1.2;
  // Subtract the textarea's own scroll so the result is relative to its
  // *visible* top-left (the wrapper-scroll case has scrollTop 0, a no-op).
  const rect: CaretRect = {
    top: marker.offsetTop - textarea.scrollTop,
    left: marker.offsetLeft - textarea.scrollLeft,
    height: lineHeight,
  };
  document.body.removeChild(mirror);

  return rect;
}
