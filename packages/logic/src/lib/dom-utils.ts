/**
 * Returns true when the currently focused element is a text input,
 * textarea, select, or contentEditable node — i.e. an element that
 * consumes keyboard input and should suppress global hotkeys.
 */
export function isInputFocused(): boolean {
  const el = document.activeElement;
  if (!el) return false;
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement)
    return true;
  if (el instanceof HTMLElement && el.isContentEditable) return true;
  if (el instanceof HTMLSelectElement) return true;
  return false;
}

/** Nearest scrollable ancestor of `el`, or null. */
export function getScrollParent(el: HTMLElement | null): HTMLElement | null {
  let node = el?.parentElement ?? null;
  while (node) {
    const style = window.getComputedStyle(node);
    const overflowY = style.overflowY;
    if (
      (overflowY === "auto" || overflowY === "scroll") &&
      node.scrollHeight > node.clientHeight
    ) {
      return node;
    }
    node = node.parentElement;
  }
  return null;
}
