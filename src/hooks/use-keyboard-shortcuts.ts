import { type RefObject, useEffect } from "react";

/** Callback map for notifying the parent component when a shortcut fires. */
interface KeyboardShortcutCallbacks {
  onBold: () => void;
  onItalic: () => void;
  onLink: () => void;
  onCodeBlock: () => void;
}

/**
 * Wrap the current text selection in the textarea with `before` and `after` strings.
 * If nothing is selected, inserts the markers at the cursor position.
 * Dispatches a synthetic `input` event so React picks up the change.
 */
function wrapSelection(
  textarea: HTMLTextAreaElement,
  before: string,
  after: string,
) {
  const { selectionStart, selectionEnd, value } = textarea;
  const selected = value.slice(selectionStart, selectionEnd);
  const replacement = `${before}${selected}${after}`;

  // "select" keeps the replaced text selected so the user can see what changed
  textarea.setRangeText(replacement, selectionStart, selectionEnd, "select");
  // Bubble an input event so controlled components (React state) stay in sync
  textarea.dispatchEvent(new Event("input", { bubbles: true }));
}

/**
 * Insert arbitrary text at the current cursor position (replacing any selection).
 * Moves the cursor to the end of the inserted text.
 */
function insertAtCursor(textarea: HTMLTextAreaElement, text: string) {
  const { selectionStart, selectionEnd } = textarea;

  // "end" places the cursor after the inserted text
  textarea.setRangeText(text, selectionStart, selectionEnd, "end");
  textarea.dispatchEvent(new Event("input", { bubbles: true }));
}

/**
 * Registers markdown-oriented keyboard shortcuts on a textarea element.
 *
 * Supported shortcuts (Ctrl/Cmd modifier):
 * - **Ctrl+B** — Bold: wraps selection in `**...**`
 * - **Ctrl+I** — Italic: wraps selection in `*...*`
 * - **Ctrl+K** — Link: wraps selection in `[text](url)` (defaults to "link" if nothing selected)
 * - **Ctrl+Shift+K** — Code block: wraps selection in fenced triple-backtick block
 * - **Tab** — Inserts two spaces (soft indent) instead of moving focus
 *
 * Each shortcut also fires the corresponding callback so the parent can
 * run side-effects (e.g. analytics, toast notifications).
 *
 * @param textareaRef - Ref to the target textarea element
 * @param callbacks - Handlers invoked after each shortcut is applied
 */
export function useKeyboardShortcuts(
  textareaRef: RefObject<HTMLTextAreaElement | null>,
  callbacks: KeyboardShortcutCallbacks,
) {
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    function handleKeyDown(event: KeyboardEvent) {
      const target = textareaRef.current;
      if (!target) return;

      // Normalize Ctrl (Windows/Linux) and Cmd (macOS) into a single flag
      const isCtrl = event.ctrlKey || event.metaKey;

      // --- Ctrl+B: Bold ---
      if (isCtrl && !event.shiftKey && event.key === "b") {
        event.preventDefault();
        wrapSelection(target, "**", "**");
        callbacks.onBold();
        return;
      }

      // --- Ctrl+I: Italic ---
      if (isCtrl && !event.shiftKey && event.key === "i") {
        event.preventDefault();
        wrapSelection(target, "*", "*");
        callbacks.onItalic();
        return;
      }

      // --- Ctrl+K: Insert markdown link ---
      if (isCtrl && !event.shiftKey && event.key === "k") {
        event.preventDefault();
        const { selectionStart, selectionEnd, value } = target;
        const selected = value.slice(selectionStart, selectionEnd);
        // Use the selected text as the link label, or fall back to "link"
        const linkText = selected || "link";
        const replacement = `[${linkText}](url)`;
        target.setRangeText(
          replacement,
          selectionStart,
          selectionEnd,
          "select",
        );
        target.dispatchEvent(new Event("input", { bubbles: true }));
        callbacks.onLink();
        return;
      }

      // --- Ctrl+Shift+K: Fenced code block ---
      if (isCtrl && event.shiftKey && event.key === "K") {
        event.preventDefault();
        const { selectionStart, selectionEnd, value } = target;
        const selected = value.slice(selectionStart, selectionEnd);
        // Surround with newlines so the fences sit on their own lines
        const replacement = `\n\`\`\`\n${selected}\n\`\`\`\n`;
        target.setRangeText(
          replacement,
          selectionStart,
          selectionEnd,
          "select",
        );
        target.dispatchEvent(new Event("input", { bubbles: true }));
        callbacks.onCodeBlock();
        return;
      }

      // --- Tab: Soft indent (2 spaces) instead of default focus-switch ---
      if (event.key === "Tab" && !isCtrl && !event.shiftKey && !event.altKey) {
        event.preventDefault();
        insertAtCursor(target, "  ");
      }
    }

    textarea.addEventListener("keydown", handleKeyDown);
    return () => {
      textarea.removeEventListener("keydown", handleKeyDown);
    };
  }, [textareaRef, callbacks]);
}
