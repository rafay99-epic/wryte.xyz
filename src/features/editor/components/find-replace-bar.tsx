"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  CaseSensitive,
  ChevronDown,
  ChevronUp,
  type LucideIcon,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useEditorStore } from "@/stores/editor-store";
import { useEditorContext } from "./editor-context";

/**
 * Floating find & replace bar for the markdown textarea. Opened with
 * Ctrl/Cmd+F (or the toolbar button); Esc closes and returns focus to the
 * editor. Matching is plain-text (case toggle), navigation selects the
 * match in the textarea and scrolls it into view.
 */
export function FindReplaceBar() {
  const open = useEditorStore((s) => s.findReplaceOpen);
  const setOpen = useEditorStore((s) => s.setFindReplaceOpen);

  // Ctrl/Cmd+F overrides browser find while an editor document is open.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (
        (event.metaKey || event.ctrlKey) &&
        !event.shiftKey &&
        !event.altKey &&
        event.key.toLowerCase() === "f"
      ) {
        event.preventDefault();
        useEditorStore.getState().setFindReplaceOpen(true);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <AnimatePresence>
      {open && <FindReplaceBody onClose={() => setOpen(false)} />}
    </AnimatePresence>
  );
}

function FindReplaceBody({ onClose }: { onClose: () => void }) {
  const content = useEditorStore((s) => s.content);
  const { textareaRef, selectRange, replaceRange, replaceContent } =
    useEditorContext();

  const [query, setQuery] = useState("");
  const [replacement, setReplacement] = useState("");
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  // First Enter selects the current match; later Enters advance.
  const hasJumpedRef = useRef(false);

  const matches = useMemo(() => {
    if (!query) return [];
    const haystack = caseSensitive ? content : content.toLowerCase();
    const needle = caseSensitive ? query : query.toLowerCase();
    const found: number[] = [];
    let index = haystack.indexOf(needle);
    while (index !== -1 && found.length < 5000) {
      found.push(index);
      index = haystack.indexOf(needle, index + needle.length);
    }
    return found;
  }, [content, query, caseSensitive]);

  // Clamp when edits shrink the match list.
  useEffect(() => {
    if (activeIndex >= matches.length) {
      setActiveIndex(matches.length > 0 ? matches.length - 1 : 0);
    }
  }, [matches.length, activeIndex]);

  const goTo = useCallback(
    (index: number) => {
      if (matches.length === 0) return;
      const next = ((index % matches.length) + matches.length) % matches.length;
      hasJumpedRef.current = true;
      setActiveIndex(next);
      const start = matches[next] as number;
      selectRange(start, start + query.length);
    },
    [matches, query.length, selectRange],
  );

  function handleFindKeyDown(event: React.KeyboardEvent) {
    if (event.key !== "Enter") return;
    event.preventDefault();
    if (event.shiftKey) {
      goTo(activeIndex - 1);
    } else {
      goTo(hasJumpedRef.current ? activeIndex + 1 : activeIndex);
    }
  }

  function replaceCurrent() {
    if (matches.length === 0) return;
    const start = matches[activeIndex] as number;
    replaceRange(start, start + query.length, replacement);
    // Content updates → matches recompute; the same index now points at the
    // next occurrence, so repeated clicks walk the document.
  }

  function replaceAll() {
    if (matches.length === 0) return;
    let result = "";
    let previousEnd = 0;
    for (const start of matches) {
      result += content.slice(previousEnd, start) + replacement;
      previousEnd = start + query.length;
    }
    result += content.slice(previousEnd);
    replaceContent(result);
    toast.success(
      `Replaced ${matches.length} occurrence${matches.length === 1 ? "" : "s"}`,
    );
  }

  function handleBarKeyDown(event: React.KeyboardEvent) {
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
      textareaRef.current?.focus();
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.15 }}
      className="absolute right-4 top-3 z-20 w-[340px] rounded-lg border border-border/60 bg-background shadow-lg"
      onKeyDown={handleBarKeyDown}
    >
      <div className="flex items-center gap-1 p-1.5">
        <Input
          autoFocus
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            hasJumpedRef.current = false;
            setActiveIndex(0);
          }}
          onKeyDown={handleFindKeyDown}
          placeholder="Find"
          className="h-7 flex-1 text-xs"
        />
        <span className="min-w-[44px] text-center text-[11px] tabular-nums text-muted-foreground">
          {query
            ? `${matches.length === 0 ? 0 : activeIndex + 1}/${matches.length}`
            : ""}
        </span>
        <BarIconButton
          icon={ChevronUp}
          label="Previous match"
          disabled={matches.length === 0}
          onClick={() => goTo(activeIndex - 1)}
        />
        <BarIconButton
          icon={ChevronDown}
          label="Next match"
          disabled={matches.length === 0}
          onClick={() =>
            goTo(hasJumpedRef.current ? activeIndex + 1 : activeIndex)
          }
        />
        <BarIconButton
          icon={CaseSensitive}
          label="Match case"
          active={caseSensitive}
          onClick={() => setCaseSensitive((v) => !v)}
        />
        <BarIconButton icon={X} label="Close" onClick={onClose} />
      </div>

      <div className="flex items-center gap-1 border-t border-border/40 p-1.5">
        <Input
          value={replacement}
          onChange={(e) => setReplacement(e.target.value)}
          placeholder="Replace with"
          className="h-7 flex-1 text-xs"
        />
        <button
          type="button"
          onClick={replaceCurrent}
          disabled={matches.length === 0}
          className="rounded-md px-2 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40"
        >
          Replace
        </button>
        <button
          type="button"
          onClick={replaceAll}
          disabled={matches.length === 0}
          className="rounded-md px-2 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40"
        >
          All
        </button>
      </div>
    </motion.div>
  );
}

function BarIconButton({
  icon: Icon,
  label,
  onClick,
  disabled = false,
  active = false,
}: {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "rounded-md p-1 transition-colors disabled:opacity-40",
        active
          ? "bg-primary/10 text-primary"
          : "text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      <Icon className="size-3.5" />
    </button>
  );
}
