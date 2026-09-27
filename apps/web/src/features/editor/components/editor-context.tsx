"use client";

import { caretRect } from "@wryte/logic/lib/dom/textarea-caret";
import { getScrollParent } from "@wryte/logic/lib/dom-utils";
import {
  createContext,
  type ReactNode,
  type RefObject,
  useCallback,
  useContext,
  useRef,
} from "react";

type SelectionSnapshot = {
  text: string;
  start: number;
  end: number;
};

type EditorContextValue = {
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  insertAtCursor: (text: string) => void;
  wrapSelection: (before: string, after: string) => void;
  replaceContent: (content: string) => void;
  getSelection: () => SelectionSnapshot | null;
  replaceRange: (start: number, end: number, replacement: string) => void;
  selectRange: (start: number, end: number) => void;
};

const EditorContext = createContext<EditorContextValue | null>(null);

export function EditorProvider({ children }: { children: ReactNode }) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const insertAtCursor = useCallback((text: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const { selectionStart, selectionEnd } = textarea;
    textarea.focus();
    textarea.setRangeText(text, selectionStart, selectionEnd, "end");
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
  }, []);

  const wrapSelection = useCallback((before: string, after: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const { selectionStart, selectionEnd, value } = textarea;
    const selected = value.slice(selectionStart, selectionEnd);
    const replacement = `${before}${selected}${after}`;

    textarea.focus();
    textarea.setRangeText(replacement, selectionStart, selectionEnd, "select");
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
  }, []);

  const replaceContent = useCallback((content: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    textarea.focus();
    textarea.setRangeText(content, 0, textarea.value.length, "end");
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
  }, []);

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

export function useEditorContext() {
  const context = useContext(EditorContext);
  if (!context) {
    throw new Error("useEditorContext must be used within an EditorProvider");
  }
  return context;
}
