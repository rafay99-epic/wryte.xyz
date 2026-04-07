"use client";

import { useCallback, useEffect } from "react";
import { useShallow } from "zustand/react/shallow";
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts";
import { useEditorStore } from "@/stores/editor-store";
import { useEditorContext } from "./editor-context";

/**
 * Redesigned raw markdown textarea editor.
 *
 * Uses an uncontrolled textarea (via `defaultValue` + ref) for performance.
 * Now features:
 *  - Custom caret color via .editor-textarea class
 *  - Improved typography with relaxed leading
 *  - Centered max-width for comfortable reading line length
 *  - Generous padding for a spacious writing feel
 */
export function MarkdownEditor() {
  const { content, setContent } = useEditorStore(
    useShallow((state) => ({
      content: state.content,
      setContent: state.setContent,
    })),
  );
  const { textareaRef } = useEditorContext();

  const onBold = useCallback(() => {}, []);
  const onItalic = useCallback(() => {}, []);
  const onLink = useCallback(() => {}, []);
  const onCodeBlock = useCallback(() => {}, []);

  useKeyboardShortcuts(textareaRef, {
    onBold,
    onItalic,
    onLink,
    onCodeBlock,
  });

  // Listen for native `input` events and push into Zustand store
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    function handleInput(e: Event) {
      const target = e.target as HTMLTextAreaElement;
      setContent(target.value);
    }

    textarea.addEventListener("input", handleInput);
    return () => {
      textarea.removeEventListener("input", handleInput);
    };
  }, [textareaRef, setContent]);

  // Sync store -> textarea when content changes externally
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea && textarea.value !== content) {
      textarea.value = content;
    }
  }, [content, textareaRef]);

  return (
    <textarea
      ref={textareaRef}
      defaultValue={content}
      className="editor-textarea h-full w-full resize-none border-0 bg-transparent px-8 py-6 font-mono text-sm leading-[1.8] text-foreground outline-none placeholder:text-muted-foreground/50 focus:ring-0"
      placeholder="Start writing..."
      spellCheck={false}
      autoComplete="off"
      autoCorrect="off"
      data-gramm="false"
    />
  );
}
