import { type RefObject, useEffect } from "react";

interface KeyboardShortcutCallbacks {
  onBold: () => void;
  onItalic: () => void;
  onLink: () => void;
  onCodeBlock: () => void;
}

function wrapSelection(
  textarea: HTMLTextAreaElement,
  before: string,
  after: string,
) {
  const { selectionStart, selectionEnd, value } = textarea;
  const selected = value.slice(selectionStart, selectionEnd);
  const replacement = `${before}${selected}${after}`;

  textarea.setRangeText(replacement, selectionStart, selectionEnd, "select");
  textarea.dispatchEvent(new Event("input", { bubbles: true }));
}

function insertAtCursor(textarea: HTMLTextAreaElement, text: string) {
  const { selectionStart, selectionEnd } = textarea;

  textarea.setRangeText(text, selectionStart, selectionEnd, "end");
  textarea.dispatchEvent(new Event("input", { bubbles: true }));
}

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

      const isCtrl = event.ctrlKey || event.metaKey;

      if (isCtrl && !event.shiftKey && event.key === "b") {
        event.preventDefault();
        wrapSelection(target, "**", "**");
        callbacks.onBold();
        return;
      }

      if (isCtrl && !event.shiftKey && event.key === "i") {
        event.preventDefault();
        wrapSelection(target, "*", "*");
        callbacks.onItalic();
        return;
      }

      if (isCtrl && !event.shiftKey && event.key === "k") {
        event.preventDefault();
        const { selectionStart, selectionEnd, value } = target;
        const selected = value.slice(selectionStart, selectionEnd);
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

      if (isCtrl && event.shiftKey && event.key === "K") {
        event.preventDefault();
        const { selectionStart, selectionEnd, value } = target;
        const selected = value.slice(selectionStart, selectionEnd);
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
