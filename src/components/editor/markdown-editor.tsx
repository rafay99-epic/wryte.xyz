"use client";

import { useCallback, useEffect } from "react";
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts";
import { useEditorStore } from "@/stores/editor-store";
import { useShallow } from "zustand/react/shallow";
import { useEditorContext } from "./editor-context";

/**
 * Raw markdown textarea editor.
 * Uses an uncontrolled textarea (via `defaultValue` + ref) for performance --
 * controlled textareas with large documents cause noticeable input lag.
 * Syncs value changes to Zustand via a native `input` event listener.
 */
export function MarkdownEditor() {
  const { content, setContent } = useEditorStore(
    useShallow((state) => ({
      content: state.content,
      setContent: state.setContent,
    })),
  );
  const { textareaRef } = useEditorContext();

  // Keyboard shortcut callbacks are no-ops here because the actual formatting
  // is handled by the toolbar via the shared EditorContext helpers.
  // These stubs are required by the useKeyboardShortcuts hook signature.
  const onBold = useCallback(() => {}, []);
  const onItalic = useCallback(() => {}, []);
  const onLink = useCallback(() => {}, []);
  const onCodeBlock = useCallback(() => {}, []);

  // Register Ctrl+B, Ctrl+I, Ctrl+K, Ctrl+Shift+K shortcuts on the textarea
  useKeyboardShortcuts(textareaRef, {
    onBold,
    onItalic,
    onLink,
    onCodeBlock,
  });

  // Listen for native `input` events (fired both by typing and by programmatic
  // setRangeText calls from the toolbar) and push the value into the Zustand store.
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

  // Sync store -> textarea when content changes externally (e.g. AI enhancement,
  // initial document load). Only writes when the values diverge to avoid
  // resetting the cursor position unnecessarily.
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
