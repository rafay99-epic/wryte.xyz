"use client";

import { useQuery } from "convex/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useShallow } from "zustand/react/shallow";
import { useKeyboardShortcuts } from "@/features/editor/hooks/use-keyboard-shortcuts";
import { useMediaPaste } from "@/features/editor/hooks/use-media-paste";
import { useTypewriterScroll } from "@/features/editor/hooks/use-typewriter-scroll";
import { splitShortcutKeys } from "@/lib/shortcuts";
import { useEditorPreferencesStore } from "@/stores/editor-preferences-store";
import { useEditorStore } from "@/stores/editor-store";
import { useShortcutsStore } from "@/stores/shortcuts-store";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { useEditorContext } from "./editor-context";
import { FocusParagraphOverlay } from "./focus-paragraph-overlay";
import { InlineAiPopover } from "./inline-ai-popover";
import { type SelectionRange, SelectionToolbar } from "./selection-toolbar";
import { SlashMenu } from "./slash-menu";
import { WikiLinkMenu } from "./wiki-link-menu";

/**
 * Raw markdown textarea editor matching the Seospace reference feel:
 * - Clean, spacious writing area with comfortable line length
 * - Generous padding for a focused writing experience
 * - Slightly larger text for readability
 * - Cmd+J inline AI enhancement for selected text
 */
export function MarkdownEditor({
  documentId,
  projectId,
  slashEnabled = false,
  snippetsEnabled = false,
  hasSnippets = false,
  animationsEnabled = false,
  selectionToolbarEnabled = true,
}: {
  documentId: string;
  projectId: string;
  slashEnabled?: boolean;
  snippetsEnabled?: boolean;
  hasSnippets?: boolean;
  animationsEnabled?: boolean;
  selectionToolbarEnabled?: boolean;
}) {
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

  // Double-click-to-edit jump from the preview. Runs after mount, so it also
  // covers the preview→edit switch where the offset was queued before this
  // textarea existed.
  const pendingCaret = useEditorStore((s) => s.pendingCaret);
  useEffect(() => {
    if (pendingCaret === null) return;
    selectRange(pendingCaret, pendingCaret);
    useEditorStore.getState().setPendingCaret(null);
  }, [pendingCaret, selectRange]);

  // Inline AI popover state
  const [inlineAiOpen, setInlineAiOpen] = useState(false);
  const [inlineAiSelection, setInlineAiSelection] = useState<{
    text: string;
    start: number;
    end: number;
  } | null>(null);
  // Set by the selection toolbar's quick actions — runs immediately on open.
  const [presetInstruction, setPresetInstruction] = useState<string | null>(
    null,
  );

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

  // Selection-toolbar quick actions: open the inline-AI popover with a
  // preset instruction that runs immediately.
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

  // Slash-menu "Ask AI to write…" — opens the inline-AI popover with a
  // collapsed selection at the caret, so the generated text inserts there.
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

  useKeyboardShortcuts(textareaRef, {
    onBold,
    onItalic,
    onLink,
    onCodeBlock,
    onInlineAI,
  });

  // Paste/drop media upload + paste-URL-over-selection linking.
  useMediaPaste({ documentId, projectId });

  // Typewriter scrolling — focus mode only, and toggleable as a persisted
  // sub-preference (default ON).
  const focusMode = useEditorStore((s) => s.focusMode);
  const typewriterScrolling = useEditorPreferencesStore(
    (s) => s.typewriterScrolling,
  );
  const typewriterActive = focusMode && typewriterScrolling;
  useTypewriterScroll(textareaRef, typewriterActive);

  // Tracks the last content value that came from a textarea input event.
  // The sync effect compares against this so it can distinguish "store
  // change echoed from the textarea" (skip — preserves the native undo
  // stack) from "store change came from elsewhere, e.g. AI apply" (write).
  // A boolean flag was the original approach but it lost the distinction
  // when an external setContent landed right after a keystroke, leaving
  // the textarea stuck on stale content while the store advanced.
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

  // Epoch the textarea was last synced against. A changed epoch means a
  // different document/draft was loaded into the store, so the echo guard
  // below must not apply — it belongs to the previous target.
  const lastSyncedEpochRef = useRef(contentEpoch);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const epochChanged = lastSyncedEpochRef.current !== contentEpoch;
    lastSyncedEpochRef.current = contentEpoch;
    if (epochChanged) {
      // A new version was loaded (draft switch, promote, restore). Without
      // resetting the echo guard, switching back to a tab whose saved text
      // equals the last thing typed here would skip the write below and
      // leave the previous tab's content on screen — which autosave would
      // then persist into the wrong draft.
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
      // Happy path: the captured range still points at the captured text.
      if (
        inlineAiSelection &&
        current.slice(start, end) === inlineAiSelection.text
      ) {
        replaceRange(start, end, replacement);
        return;
      }
      // Content shifted while the AI ran. A bare `indexOf` would silently
      // hit the wrong occurrence (the user's "the" picked from paragraph A
      // could land in paragraph Z). Bail with a clear error and let the
      // user re-trigger after re-selecting.
      toast.error(
        "Original text was modified while the AI was running — please re-select and try again",
      );
    },
    [replaceRange, inlineAiSelection],
  );

  return (
    <div className="relative mx-auto w-full max-w-[860px]">
      {/* Inline AI popover — floats above the editor */}
      <InlineAiPopover
        open={inlineAiOpen}
        onOpenChange={handleInlineAiOpenChange}
        selection={inlineAiSelection}
        onAccept={handleAcceptInline}
        presetInstruction={presetInstruction}
      />

      {selectionToolbarEnabled && (
        <SelectionToolbar aiReady={aiReady} onAiAction={handleQuickAiAction} />
      )}

      <WikiLinkMenu
        projectId={activeProjectId ? (activeProjectId as Id<"projects">) : null}
        documentId={documentId}
      />

      <SlashMenu
        blockCommandsEnabled={slashEnabled}
        snippetsEnabled={snippetsEnabled}
        hasSnippets={hasSnippets}
        animationsEnabled={animationsEnabled}
        projectId={activeProjectId ? (activeProjectId as Id<"projects">) : null}
        aiReady={aiReady}
        onAiAction={handleSlashAi}
      />

      {focusMode && <FocusParagraphOverlay />}

      <textarea
        ref={textareaRef}
        defaultValue={content}
        // Locked while a version switch is in flight: a keystroke landing in
        // the outgoing tab's buffer would otherwise be autosaved into the
        // wrong version. Cache-hit switches resolve within a tick, so this
        // never blocks real typing.
        readOnly={isVersionSwitching}
        className="editor-textarea h-full min-h-[calc(100vh-120px)] w-full resize-none border-0 bg-transparent px-10 py-8 text-[15px] leading-[1.85] text-foreground outline-none placeholder:text-muted-foreground/40 focus:ring-0"
        placeholder="Start writing your article..."
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
