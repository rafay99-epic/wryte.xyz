"use client";

import {
  createContext,
  type ReactNode,
  type RefObject,
  useCallback,
  useContext,
  useRef,
} from "react";

interface EditorContextValue {
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  insertAtCursor: (text: string) => void;
  wrapSelection: (before: string, after: string) => void;
  replaceContent: (content: string) => void;
}

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

    textarea.value = content;
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
  }, []);

  return (
    <EditorContext.Provider
      value={{ textareaRef, insertAtCursor, wrapSelection, replaceContent }}
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
