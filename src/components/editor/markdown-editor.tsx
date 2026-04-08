"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { useShallow } from "zustand/react/shallow";
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts";
import { splitShortcutKeys } from "@/lib/shortcuts";
import { useEditorStore } from "@/stores/editor-store";
import { useShortcutsStore } from "@/stores/shortcuts-store";
import { useEditorContext } from "./editor-context";
import { InlineAiPopover } from "./inline-ai-popover";

/**
 * Raw markdown textarea editor matching the Seospace reference feel:
 * - Clean, spacious writing area with comfortable line length
 * - Generous padding for a focused writing experience
 * - Slightly larger text for readability
 * - Cmd+J inline AI enhancement for selected text
 */
export function MarkdownEditor() {
  const { content, setContent } = useEditorStore(
    useShallow((state) => ({
      content: state.content,
      setContent: state.setContent,
    })),
  );
  const { textareaRef, getSelection, replaceRange } = useEditorContext();

  // Inline AI popover state
  const [inlineAiOpen, setInlineAiOpen] = useState(false);
  const [inlineAiSelection, setInlineAiSelection] = useState<{
    text: string;
    start: number;
    end: number;
  } | null>(null);

  const onBold = useCallback(() => {}, []);
  const onItalic = useCallback(() => {}, []);
  const onLink = useCallback(() => {}, []);
  const onCodeBlock = useCallback(() => {}, []);

  const inlineAiKeys = useShortcutsStore((s) => s.getKeys("inlineAI"));
  const inlineAiLabel = splitShortcutKeys(inlineAiKeys).join("+");

  const onInlineAI = useCallback(() => {
    const sel = getSelection();
    if (!sel) {
      toast("Select some text first", {
        description: `Highlight the text you want to transform, then press ${inlineAiLabel}`,
        duration: 2500,
      });
      return;
    }
    setInlineAiSelection(sel);
    setInlineAiOpen(true);
  }, [getSelection, inlineAiLabel]);

  useKeyboardShortcuts(textareaRef, {
    onBold,
    onItalic,
    onLink,
    onCodeBlock,
    onInlineAI,
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

  const handleAcceptInline = useCallback(
    (start: number, end: number, replacement: string) => {
      replaceRange(start, end, replacement);
    },
    [replaceRange],
  );

  return (
    <div className="relative mx-auto w-full max-w-[860px]">
      {/* Inline AI popover — floats above the editor */}
      <InlineAiPopover
        open={inlineAiOpen}
        onOpenChange={setInlineAiOpen}
        selection={inlineAiSelection}
        onAccept={handleAcceptInline}
      />

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
