"use client";

import { api } from "@wryte/backend/_generated/api";
import { useIsMacPlatform } from "@wryte/logic/hooks/use-is-mac-platform";
import {
  type EditorFeatures,
  targetProjectId,
} from "@wryte/logic/lib/editor/features";
import type { EditorTarget } from "@wryte/logic/lib/editor/target";
import { splitShortcutKeys } from "@wryte/logic/lib/shortcuts";
import { useEditorPreferencesStore } from "@wryte/logic/stores/editor-preferences-store";
import { useEditorStore } from "@wryte/logic/stores/editor-store";
import { useShortcutsStore } from "@wryte/logic/stores/shortcuts-store";
import { useQuery } from "convex/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useShallow } from "zustand/react/shallow";
import { useKeyboardShortcuts } from "@/features/editor/hooks/use-keyboard-shortcuts";
import { useMediaPaste } from "@/features/editor/hooks/use-media-paste";
import { useTypewriterScroll } from "@/features/editor/hooks/use-typewriter-scroll";
import { useEditorContext } from "./editor-context";
import { FocusParagraphOverlay } from "./focus-paragraph-overlay";
import { InlineAiPopover } from "./inline-ai-popover";
import { type SelectionRange, SelectionToolbar } from "./selection-toolbar";
import { SlashMenu } from "./slash-menu";
import { WikiLinkMenu } from "./wiki-link-menu";

export function MarkdownEditor({
  target,
  features,
  onBlur,
}: {
  target: EditorTarget;
  features: EditorFeatures;
  onBlur?: () => void;
}) {
  const projectId = targetProjectId(target);
  const { content, contentEpoch, setContent, isVersionSwitching } =
    useEditorStore(
      useShallow((state) => ({
        content: state.content,
        contentEpoch: state.contentEpoch,
        setContent: state.setContent,
        isVersionSwitching: state.switchTarget !== null,
      })),
    );
  const { textareaRef, getSelection, replaceRange, selectRange } =
    useEditorContext();

  const pendingCaret = useEditorStore((s) => s.pendingCaret);
  useEffect(() => {
    if (pendingCaret === null) return;
    selectRange(pendingCaret, pendingCaret);
    useEditorStore.getState().setPendingCaret(null);
  }, [pendingCaret, selectRange]);

  const [inlineAiOpen, setInlineAiOpen] = useState(false);
  const [inlineAiSelection, setInlineAiSelection] = useState<{
    text: string;
    start: number;
    end: number;
  } | null>(null);
  const [presetInstruction, setPresetInstruction] = useState<string | null>(
    null,
  );

  const inlineAiKeys = useShortcutsStore((s) => s.getKeys("inlineAI"));
  const isMacPlatform = useIsMacPlatform();
  const inlineAiLabel = splitShortcutKeys(inlineAiKeys, isMacPlatform).join(
    "+",
  );

  const aiReadiness = useQuery(
    api.ai.enhance.isAiReady,
    projectId ? { projectId } : "skip",
  );
  const aiReady = aiReadiness?.ready ?? false;

  const notifyAiNotReady = useCallback(() => {
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
    toast("AI is not configured", { description: message, duration: 3500 });
  }, [aiReadiness?.reason]);

  const onInlineAI = useCallback(() => {
    if (!aiReady) {
      notifyAiNotReady();
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
    setPresetInstruction(null);
    setInlineAiSelection(sel);
    setInlineAiOpen(true);
  }, [aiReady, notifyAiNotReady, getSelection, inlineAiLabel]);

  const handleQuickAiAction = useCallback(
    (instruction: string, selection: SelectionRange) => {
      if (!aiReady) {
        notifyAiNotReady();
        return;
      }
      setInlineAiSelection(selection);
      setPresetInstruction(instruction);
      setInlineAiOpen(true);
    },
    [aiReady, notifyAiNotReady],
  );

  const handleInlineAiOpenChange = useCallback((open: boolean) => {
    setInlineAiOpen(open);
    if (!open) setPresetInstruction(null);
  }, []);

  const handleSlashAi = useCallback(
    (caretIndex: number) => {
      if (!aiReady) {
        notifyAiNotReady();
        return;
      }
      setPresetInstruction(null);
      setInlineAiSelection({ text: "", start: caretIndex, end: caretIndex });
      setInlineAiOpen(true);
    },
    [aiReady, notifyAiNotReady],
  );

  useKeyboardShortcuts(textareaRef, projectId ? { onInlineAI } : {});

  useMediaPaste({ target });

  const focusMode = useEditorStore((s) => s.focusMode);
  const typewriterScrolling = useEditorPreferencesStore(
    (s) => s.typewriterScrolling,
  );
  const typewriterActive = focusMode && typewriterScrolling;
  useTypewriterScroll(textareaRef, typewriterActive);

  const lastInputContentRef = useRef<string | null>(null);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    function handleInput(e: Event) {
      const target = e.target as HTMLTextAreaElement;
      lastInputContentRef.current = target.value;
      setContent(target.value);
    }

    textarea.addEventListener("input", handleInput);
    return () => {
      textarea.removeEventListener("input", handleInput);
    };
  }, [textareaRef, setContent]);

  const lastSyncedEpochRef = useRef(contentEpoch);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const epochChanged = lastSyncedEpochRef.current !== contentEpoch;
    lastSyncedEpochRef.current = contentEpoch;
    if (epochChanged) {
      lastInputContentRef.current = null;
      if (textarea.value !== content) textarea.value = content;
      return;
    }

    if (content === lastInputContentRef.current) return;
    if (textarea.value !== content) {
      textarea.value = content;
    }
  }, [content, contentEpoch, textareaRef]);

  const handleAcceptInline = useCallback(
    (start: number, end: number, replacement: string) => {
      const current = useEditorStore.getState().content;
      if (
        inlineAiSelection &&
        current.slice(start, end) === inlineAiSelection.text
      ) {
        replaceRange(start, end, replacement);
        return;
      }
      toast.error(
        "Original text was modified while the AI was running — please re-select and try again",
      );
    },
    [replaceRange, inlineAiSelection],
  );

  return (
    <div className="relative mx-auto w-full max-w-[860px]">
      {target.kind === "document" && (
        <InlineAiPopover
          open={inlineAiOpen}
          onOpenChange={handleInlineAiOpenChange}
          selection={inlineAiSelection}
          onAccept={handleAcceptInline}
          presetInstruction={presetInstruction}
        />
      )}

      {features.selectionToolbar && (
        <SelectionToolbar aiReady={aiReady} onAiAction={handleQuickAiAction} />
      )}

      {target.kind === "document" && (
        <WikiLinkMenu
          projectId={target.projectId}
          documentId={target.documentId}
        />
      )}

      <SlashMenu
        blockCommandsEnabled={features.slash}
        snippetsEnabled={features.snippets}
        hasSnippets={features.hasSnippets}
        animationsEnabled={features.animations}
        projectId={projectId}
        aiReady={aiReady}
        onAiAction={handleSlashAi}
      />

      {focusMode && <FocusParagraphOverlay />}

      <textarea
        ref={textareaRef}
        defaultValue={content}
        readOnly={isVersionSwitching}
        onBlur={onBlur}
        className="editor-textarea h-full min-h-[calc(100vh-120px)] w-full resize-none border-0 bg-transparent px-10 py-8 text-[15px] leading-[1.85] text-foreground outline-none placeholder:text-muted-foreground/40 focus:ring-0"
        placeholder={
          target.kind === "document"
            ? "Start writing your article..."
            : "Start writing..."
        }
        spellCheck={false}
        autoComplete="off"
        autoCorrect="off"
        data-gramm="false"
        data-editor="true"
        data-typewriter={typewriterActive ? "true" : undefined}
      />
    </div>
  );
}
