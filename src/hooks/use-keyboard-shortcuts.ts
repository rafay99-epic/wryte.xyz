import { type RefObject, useEffect, useRef } from "react";
import { useShortcutsStore } from "@/stores/shortcuts-store";

/** Callback map for notifying the parent component when a shortcut fires. */
type KeyboardShortcutCallbacks = {
  onBold: () => void;
  onItalic: () => void;
  onLink: () => void;
  onCodeBlock: () => void;
  onInlineAI?: () => void;
};

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
 * Parse a TanStack-style binding string (e.g. "Mod+j", "Mod+Shift+k")
 * and check if a KeyboardEvent matches it.
 */
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

/**
 * Registers markdown-oriented keyboard shortcuts on a textarea element.
 *
 * Supported shortcuts (Ctrl/Cmd modifier):
 * - **Ctrl+B** — Bold: wraps selection in `**...**`
 * - **Ctrl+I** — Italic: wraps selection in `*...*`
 * - **Ctrl+K** — Link: wraps selection in `[text](url)` (defaults to "link" if nothing selected)
 * - **Ctrl+Shift+K** — Code block: wraps selection in fenced triple-backtick block
 * - **Configurable** — Inline AI: transform selected text with custom prompt (default Mod+J)
 * - **Tab** — Inserts two spaces (soft indent) instead of moving focus
 *
 * Each shortcut also fires the corresponding callback so the parent can
 * run side-effects (e.g. analytics, toast notifications).
 *
 * Uses a stable ref for callbacks so the event listener is not torn down
 * and re-attached on every render (prevents excessive addEventListener cycles).
 *
 * @param textareaRef - Ref to the target textarea element
 * @param callbacks - Handlers invoked after each shortcut is applied
 */
export function useKeyboardShortcuts(
  textareaRef: RefObject<HTMLTextAreaElement | null>,
  callbacks: KeyboardShortcutCallbacks,
) {
  // Store the latest callbacks in a ref to avoid re-registering the listener
  // every time the parent re-renders with a new callback object.
  const callbacksRef = useRef(callbacks);
  useEffect(() => {
    callbacksRef.current = callbacks;
  });

  // Read the inline AI binding from the shortcuts store (reactive)
  const inlineAiKeys = useShortcutsStore((s) => s.getKeys("inlineAI"));

  // Store the binding in a ref so the keydown handler always reads the latest
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

      // Normalize Ctrl (Windows/Linux) and Cmd (macOS) into a single flag
      const isCtrl = event.ctrlKey || event.metaKey;

      // --- Ctrl+B: Bold ---
      if (isCtrl && !event.shiftKey && !event.altKey && event.key === "b") {
        event.preventDefault();
        wrapSelection(target, "**", "**");
        cb.onBold();
        return;
      }

      // --- Ctrl+I: Italic ---
      if (isCtrl && !event.shiftKey && !event.altKey && event.key === "i") {
        event.preventDefault();
        wrapSelection(target, "*", "*");
        cb.onItalic();
        return;
      }

      // --- Ctrl+K: Insert markdown link ---
      if (isCtrl && !event.shiftKey && !event.altKey && event.key === "k") {
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
        cb.onLink();
        return;
      }

      // --- Ctrl+Shift+K: Fenced code block ---
      if (isCtrl && event.shiftKey && !event.altKey && event.key === "K") {
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
        cb.onCodeBlock();
        return;
      }

      // --- Inline AI (configurable shortcut, default Mod+J) ---
      if (cb.onInlineAI && matchesBinding(event, inlineAiKeysRef.current)) {
        event.preventDefault();
        cb.onInlineAI();
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
    // Only re-register when the textarea ref changes, NOT on callback changes
  }, [textareaRef]);
}
