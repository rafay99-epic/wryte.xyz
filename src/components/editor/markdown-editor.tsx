"use client";

import { useCallback, useEffect } from "react";
import { useShallow } from "zustand/react/shallow";
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts";
import { useEditorStore } from "@/stores/editor-store";
import { useEditorContext } from "./editor-context";

/**
 * Raw markdown textarea editor matching the Seospace reference feel:
 * - Clean, spacious writing area with comfortable line length
 * - Generous padding for a focused writing experience
 * - Slightly larger text for readability
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
    <div className="mx-auto w-full max-w-[860px]">
      <textarea
        ref={textareaRef}
        defaultValue={content}
        className="editor-textarea h-full min-h-[calc(100vh-120px)] w-full resize-none border-0 bg-transparent px-10 py-8 text-[15px] leading-[1.85] text-foreground outline-none placeholder:text-muted-foreground/40 focus:ring-0"
        placeholder="Start writing your article..."
        spellCheck={false}
        autoComplete="off"
        autoCorrect="off"
        data-gramm="false"
      />
    </div>
  );
}
