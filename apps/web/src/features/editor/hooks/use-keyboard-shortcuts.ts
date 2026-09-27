import {
  listEnterAction,
  listIndentAction,
} from "@wryte/logic/lib/editor/lists";
import { useShortcutsStore } from "@wryte/logic/stores/shortcuts-store";
import { type RefObject, useEffect, useRef } from "react";

type KeyboardShortcutCallbacks = {
  onInlineAI?: () => void;
};

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

function matchesBinding(event: KeyboardEvent, binding: string): boolean {
  if (!binding) return false;

  const parts = binding.toLowerCase().split("+");
  const key = parts[parts.length - 1] ?? "";
  const needsMod = parts.includes("mod");
  const needsShift = parts.includes("shift");
  const needsAlt = parts.includes("alt");

  const hasMod = event.ctrlKey || event.metaKey;

  if (needsMod && !hasMod) return false;
  if (!needsMod && hasMod) return false;
  if (needsShift && !event.shiftKey) return false;
  if (!needsShift && event.shiftKey) return false;
  if (needsAlt && !event.altKey) return false;
  if (!needsAlt && event.altKey) return false;

  return event.key.toLowerCase() === key;
}

export function useKeyboardShortcuts(
  textareaRef: RefObject<HTMLTextAreaElement | null>,
  callbacks: KeyboardShortcutCallbacks,
) {
  const callbacksRef = useRef(callbacks);
  useEffect(() => {
    callbacksRef.current = callbacks;
  });

  const inlineAiKeys = useShortcutsStore((s) => s.getKeys("inlineAI"));

  const inlineAiKeysRef = useRef(inlineAiKeys);
  useEffect(() => {
    inlineAiKeysRef.current = inlineAiKeys;
  }, [inlineAiKeys]);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    function handleKeyDown(event: KeyboardEvent) {
      const target = textareaRef.current;
      if (!target) return;

      const cb = callbacksRef.current;

      const isCtrl = event.ctrlKey || event.metaKey;

      if (isCtrl && !event.shiftKey && !event.altKey && event.key === "b") {
        event.preventDefault();
        wrapSelection(target, "**", "**");
        return;
      }

      if (isCtrl && !event.shiftKey && !event.altKey && event.key === "i") {
        event.preventDefault();
        wrapSelection(target, "*", "*");
        return;
      }

      if (isCtrl && !event.shiftKey && !event.altKey && event.key === "k") {
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
        return;
      }

      if (isCtrl && event.shiftKey && !event.altKey && event.key === "K") {
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
        return;
      }

      if (cb.onInlineAI && matchesBinding(event, inlineAiKeysRef.current)) {
        event.preventDefault();
        cb.onInlineAI();
        return;
      }

      if (
        event.key === "Enter" &&
        !isCtrl &&
        !event.shiftKey &&
        !event.altKey &&
        !event.defaultPrevented &&
        !event.isComposing &&
        target.selectionStart === target.selectionEnd
      ) {
        const action = listEnterAction(target.value, target.selectionStart);
        if (action) {
          event.preventDefault();
          if (action.type === "continue") {
            target.setRangeText(
              action.insert,
              target.selectionStart,
              target.selectionStart,
              "end",
            );
          } else {
            target.setRangeText("", action.start, action.end, "end");
          }
          target.dispatchEvent(new Event("input", { bubbles: true }));
          return;
        }
      }

      if (
        event.key === "Tab" &&
        !isCtrl &&
        !event.altKey &&
        !event.defaultPrevented &&
        target.selectionStart === target.selectionEnd
      ) {
        const action = listIndentAction(
          target.value,
          target.selectionStart,
          event.shiftKey,
        );
        if (action) {
          event.preventDefault();
          if (action.insert !== undefined) {
            target.setRangeText(
              action.insert,
              action.lineStart,
              action.lineStart,
              "preserve",
            );
          } else if (action.remove !== undefined) {
            target.setRangeText(
              "",
              action.lineStart,
              action.lineStart + action.remove,
              "preserve",
            );
          }
          target.dispatchEvent(new Event("input", { bubbles: true }));
          return;
        }
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
  }, [textareaRef]);
}
