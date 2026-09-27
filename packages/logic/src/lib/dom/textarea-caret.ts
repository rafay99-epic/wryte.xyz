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
  top: number;
  left: number;
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
  style.boxSizing = "border-box";
  style.width = `${textarea.clientWidth}px`;

  const value = textarea.value;
  mirror.textContent = value.slice(0, Math.max(0, index));

  const marker = document.createElement("span");
  marker.textContent = value.slice(index, index + 1) || ".";
  mirror.appendChild(marker);

  document.body.appendChild(mirror);
  const lineHeight =
    Number.parseFloat(computed.lineHeight) ||
    Number.parseFloat(computed.fontSize) * 1.2;
  const rect: CaretRect = {
    top: marker.offsetTop - textarea.scrollTop,
    left: marker.offsetLeft - textarea.scrollLeft,
    height: lineHeight,
  };
  document.body.removeChild(mirror);

  return rect;
}
