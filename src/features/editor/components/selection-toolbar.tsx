"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Bold, Italic, Link, type LucideIcon, Sparkles } from "lucide-react";
import { memo, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import { caretRect } from "../lib/caret/textarea-caret";
import { useEditorContext } from "./editor-context";

export type SelectionRange = { text: string; start: number; end: number };

type SelectionToolbarProps = {
  /** Gates the AI quick actions; formatting buttons always show. */
  aiReady: boolean;
  /** Run an AI quick action on the given selection. */
  onAiAction: (instruction: string, selection: SelectionRange) => void;
};

const TOOLBAR_HEIGHT = 36;
const SHOW_DELAY_MS = 250;

const AI_QUICK_ACTIONS: { label: string; instruction: string }[] = [
  {
    label: "Improve",
    instruction:
      "Improve this writing: tighten the phrasing and make it flow better while keeping the meaning, tone, and markdown formatting.",
  },
  {
    label: "Shorten",
    instruction:
      "Make this more concise without losing meaning. Keep the tone and markdown formatting.",
  },
  {
    label: "Expand",
    instruction:
      "Expand this with more detail and depth, keeping the same tone, style, and markdown formatting.",
  },
  {
    label: "Fix grammar",
    instruction:
      "Fix grammar, spelling, and punctuation only. Do not rewrite or rephrase otherwise, and keep the markdown formatting intact.",
  },
];

/**
 * Floating toolbar that appears above a settled text selection in the
 * editor: quick formatting plus one-click AI transforms (which route
 * through the inline-AI popover with a preset instruction).
 *
 * Memoized for the same reason as the slash menu — the parent re-renders
 * per keystroke, this only cares about selection state.
 */
export const SelectionToolbar = memo(function SelectionToolbar({
  aiReady,
  onAiAction,
}: SelectionToolbarProps) {
  const { textareaRef, wrapSelection } = useEditorContext();
  const [position, setPosition] = useState<{
    top: number;
    left: number;
  } | null>(null);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    let timer: ReturnType<typeof setTimeout> | null = null;
    const hide = () => {
      if (timer) clearTimeout(timer);
      setPosition((p) => (p === null ? p : null));
    };

    const evaluate = () => {
      if (document.activeElement !== textarea) return hide();
      const { selectionStart, selectionEnd } = textarea;
      if (selectionStart === selectionEnd) return hide();
      const rect = caretRect(textarea, selectionStart);
      if (!rect) return hide();
      const taRect = textarea.getBoundingClientRect();
      const top = taRect.top + rect.top;
      setPosition({
        // Above the selection's first line; below it when too close to the
        // viewport top.
        top:
          top - TOOLBAR_HEIGHT - 8 > 8
            ? top - TOOLBAR_HEIGHT - 8
            : top + rect.height + 8,
        left: taRect.left + rect.left,
      });
    };

    // Debounce so the toolbar appears once the selection settles instead
    // of chasing the cursor mid-drag.
    const schedule = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(evaluate, SHOW_DELAY_MS);
    };
    const onSelectionChange = () => {
      if (document.activeElement === textarea) schedule();
      else hide();
    };
    const onScroll = (e: Event) => {
      const target = e.target;
      if (
        target instanceof Element &&
        target.closest("[data-selection-toolbar]")
      ) {
        return;
      }
      hide();
    };

    document.addEventListener("selectionchange", onSelectionChange);
    textarea.addEventListener("blur", hide);
    window.addEventListener("scroll", onScroll, {
      capture: true,
      passive: true,
    });
    window.addEventListener("resize", hide);

    return () => {
      if (timer) clearTimeout(timer);
      document.removeEventListener("selectionchange", onSelectionChange);
      textarea.removeEventListener("blur", hide);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", hide);
    };
  }, [textareaRef]);

  if (typeof document === "undefined") return null;

  function currentSelection(): SelectionRange | null {
    const textarea = textareaRef.current;
    if (!textarea) return null;
    const { selectionStart, selectionEnd, value } = textarea;
    if (selectionStart === selectionEnd) return null;
    return {
      text: value.slice(selectionStart, selectionEnd),
      start: selectionStart,
      end: selectionEnd,
    };
  }

  function handleAiAction(instruction: string) {
    const selection = currentSelection();
    if (!selection) return;
    setPosition(null);
    onAiAction(instruction, selection);
  }

  const overlay = position && (
    <motion.div
      key="selection-toolbar"
      data-selection-toolbar
      initial={{ opacity: 0, y: 4, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 4, scale: 0.97 }}
      transition={{ duration: 0.12, ease: [0.16, 1, 0.3, 1] }}
      style={{
        top: position.top,
        left: Math.max(8, Math.min(position.left, window.innerWidth - 320)),
      }}
      className="fixed z-50 flex items-center gap-0.5 rounded-lg border border-border/60 bg-popover p-1 shadow-lg"
    >
      <FormatButton
        icon={Bold}
        label="Bold"
        onClick={() => wrapSelection("**", "**")}
      />
      <FormatButton
        icon={Italic}
        label="Italic"
        onClick={() => wrapSelection("*", "*")}
      />
      <FormatButton
        icon={Link}
        label="Link"
        onClick={() => wrapSelection("[", "](url)")}
      />
      {aiReady && (
        <>
          <div className="mx-0.5 h-4 w-px bg-border/50" />
          <Sparkles className="ml-0.5 size-3 text-primary/70" />
          {AI_QUICK_ACTIONS.map((action) => (
            <button
              key={action.label}
              type="button"
              // Keep focus (and the selection) in the textarea.
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => handleAiAction(action.instruction)}
              className="rounded-md px-1.5 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary"
            >
              {action.label}
            </button>
          ))}
        </>
      )}
    </motion.div>
  );

  return createPortal(
    <AnimatePresence>{overlay}</AnimatePresence>,
    document.body,
  );
});

function FormatButton({
  icon: Icon,
  label,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={cn(
        "rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
      )}
    >
      <Icon className="size-3.5" />
    </button>
  );
}
