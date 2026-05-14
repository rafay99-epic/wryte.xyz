"use client";

import { useQuery } from "convex/react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { useShallow } from "zustand/react/shallow";
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts";
import { splitShortcutKeys } from "@/lib/shortcuts";
import { useEditorStore } from "@/stores/editor-store";
import { useShortcutsStore } from "@/stores/shortcuts-store";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
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

  // Inline AI is only available once the project's AI provider has an
  // active credential. We still register the shortcut so users discover
  // the feature, but route them to settings when nothing's configured.
  const activeProjectId = useEditorStore((s) => s.activeProjectId);
  const aiReadiness = useQuery(
    api.ai.enhance.isAiReady,
    activeProjectId ? { projectId: activeProjectId as Id<"projects"> } : "skip",
  );
  const aiReady = aiReadiness?.ready ?? false;

  const onInlineAI = useCallback(() => {
    if (!aiReady) {
      const reason = aiReadiness?.reason;
      const message =
        reason === "no-credential" || reason === "invalid"
          ? "Add your API key in Project Settings → AI to enable inline AI."
          : reason === "no-provider" || reason === "no-model"
            ? "Pick an AI provider and model in Project Settings → AI."
            : reason === "verifying"
              ? "Your API key is still being verified — try again in a moment."
              : reason === "rotating"
                ? "Your API key is being rotated — try again in a moment."
                : "AI isn't ready yet for this project.";
      toast("AI is not configured", {
        description: message,
        duration: 3500,
      });
      return;
    }
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
  }, [aiReady, aiReadiness?.reason, getSelection, inlineAiLabel]);

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
