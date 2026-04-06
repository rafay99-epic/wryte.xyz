"use client";

import { useCallback, useEffect } from "react";
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts";
import { useEditorStore } from "@/stores/editor-store";
import { useShallow } from "zustand/react/shallow";
import { useEditorContext } from "./editor-context";

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
      className="h-full w-full resize-none border-0 bg-transparent p-6 font-mono text-sm leading-relaxed text-foreground outline-none placeholder:text-muted-foreground focus:ring-0"
      placeholder="Start writing your content in markdown..."
      spellCheck={false}
    />
  );
}
