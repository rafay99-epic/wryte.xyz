"use client";

import {
  createContext,
  type ReactNode,
  type RefObject,
  useCallback,
  useContext,
  useRef,
} from "react";
import { caretRect } from "../lib/caret/textarea-caret";
import { getScrollParent } from "../lib/scroll";

/**
 * Shape of the editor context value shared across all editor sub-components.
 * Provides a shared textarea ref and helper functions for programmatic text manipulation.
 */
type SelectionSnapshot = {
  text: string;
  start: number;
  end: number;
};

type EditorContextValue = {
  /** Ref to the underlying <textarea> so toolbar/shortcuts can manipulate it directly */
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  insertAtCursor: (text: string) => void;
  wrapSelection: (before: string, after: string) => void;
  replaceContent: (content: string) => void;
  /** Returns the currently selected text and its start/end indices, or null if nothing is selected */
  getSelection: () => SelectionSnapshot | null;
  /** Replaces a specific character range in the textarea with new text */
  replaceRange: (start: number, end: number, replacement: string) => void;
  /** Selects a character range and scrolls it into view. Selection-only — never mutates content. */
  selectRange: (start: number, end: number) => void;
};

const EditorContext = createContext<EditorContextValue | null>(null);

/**
 * Provides editor text-manipulation utilities to all children via React context.
 * Holds a single shared ref to the markdown textarea, enabling the toolbar,
 * keyboard shortcuts, and dialogs to insert/wrap/replace text without prop drilling.
 */
export function EditorProvider({ children }: { children: ReactNode }) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  /**
   * Insert text at the current cursor position (or replace the current selection).
   * Uses the native `setRangeText` API so the browser's undo stack is preserved.
   * Dispatches a synthetic `input` event so React state stays in sync.
   */
  const insertAtCursor = useCallback((text: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const { selectionStart, selectionEnd } = textarea;
    textarea.focus();
    // "end" moves the cursor to after the inserted text
    textarea.setRangeText(text, selectionStart, selectionEnd, "end");
    // Synthetic event ensures the Zustand store picks up the change
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
  }, []);

  /**
   * Wrap the currently selected text with `before` and `after` strings.
   * e.g. wrapSelection("**", "**") turns "hello" into "**hello**".
   * If nothing is selected, inserts both markers at the cursor so the user can type between them.
   */
  const wrapSelection = useCallback((before: string, after: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const { selectionStart, selectionEnd, value } = textarea;
    const selected = value.slice(selectionStart, selectionEnd);
    const replacement = `${before}${selected}${after}`;

    textarea.focus();
    // "select" keeps the wrapped text highlighted for easy further editing
    textarea.setRangeText(replacement, selectionStart, selectionEnd, "select");
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
  }, []);

  /**
   * Replace the entire textarea content. Used by the AI enhancement feature
   * to swap the full document body in one operation.
   */
  const replaceContent = useCallback((content: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    textarea.focus();
    textarea.setRangeText(content, 0, textarea.value.length, "end");
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
  }, []);

  /**
   * Snapshot the current text selection. Returns null if nothing is selected.
   * Must be called BEFORE focus moves away from the textarea (e.g. before opening a popover).
   */
  const getSelection = useCallback((): SelectionSnapshot | null => {
    const textarea = textareaRef.current;
    if (!textarea) return null;
    const { selectionStart, selectionEnd, value } = textarea;
    if (selectionStart === selectionEnd) return null;
    return {
      text: value.slice(selectionStart, selectionEnd),
      start: selectionStart,
      end: selectionEnd,
    };
  }, []);

  /**
   * Replace a specific character range with new text.
   * Used by inline AI to swap only the selected portion.
   */
  const replaceRange = useCallback(
    (start: number, end: number, replacement: string) => {
      const textarea = textareaRef.current;
      if (!textarea) return;
      textarea.focus();
      textarea.setRangeText(replacement, start, end, "end");
      textarea.dispatchEvent(new Event("input", { bubbles: true }));
    },
    [],
  );

  /**
   * Select a character range and scroll it into view. Used by the readability
   * panel's jump-to-sentence. Pure selection (no `setRangeText`), so it never
   * touches the undo stack.
   */
  const selectRange = useCallback((start: number, end: number) => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.focus();
    textarea.setSelectionRange(start, end);

    const rect = caretRect(textarea, start);
    const scroller = getScrollParent(textarea);
    if (!rect || !scroller) return;
    const caretViewportTop = textarea.getBoundingClientRect().top + rect.top;
    const scrollerTop = scroller.getBoundingClientRect().top;
    // Bring the caret to roughly the upper third of the scroll viewport.
    const delta = caretViewportTop - scrollerTop - scroller.clientHeight / 3;
    scroller.scrollBy({ top: delta, behavior: "smooth" });
  }, []);

  return (
    <EditorContext.Provider
      value={{
        textareaRef,
        insertAtCursor,
        wrapSelection,
        replaceContent,
        getSelection,
        replaceRange,
        selectRange,
      }}
    >
      {children}
    </EditorContext.Provider>
  );
}

/**
 * Hook to access the shared editor context. Must be called inside an <EditorProvider>.
 * Throws a descriptive error if used outside the provider boundary to aid debugging.
 */
export function useEditorContext() {
  const context = useContext(EditorContext);
  if (!context) {
    throw new Error("useEditorContext must be used within an EditorProvider");
  }
  return context;
}
