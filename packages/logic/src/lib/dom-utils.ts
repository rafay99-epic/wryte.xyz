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
