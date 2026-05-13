"use client";

import { useMutation } from "convex/react";
import { Plus, Tag, X } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";

// ---------------------------------------------------------------------------
// Tag color helpers (mirrors tag-badges.tsx for visual consistency)
// ---------------------------------------------------------------------------

const TAG_COLORS = [
  "bg-blue-500/10 text-blue-700 border-blue-200 dark:text-blue-300 dark:border-blue-800",
  "bg-emerald-500/10 text-emerald-700 border-emerald-200 dark:text-emerald-300 dark:border-emerald-800",
  "bg-purple-500/10 text-purple-700 border-purple-200 dark:text-purple-300 dark:border-purple-800",
  "bg-amber-500/10 text-amber-700 border-amber-200 dark:text-amber-300 dark:border-amber-800",
  "bg-pink-500/10 text-pink-700 border-pink-200 dark:text-pink-300 dark:border-pink-800",
  "bg-cyan-500/10 text-cyan-700 border-cyan-200 dark:text-cyan-300 dark:border-cyan-800",
  "bg-orange-500/10 text-orange-700 border-orange-200 dark:text-orange-300 dark:border-orange-800",
  "bg-indigo-500/10 text-indigo-700 border-indigo-200 dark:text-indigo-300 dark:border-indigo-800",
];

function hashTag(tag: string): number {
  let hash = 0;
  for (let i = 0; i < tag.length; i++) {
    hash = (hash << 5) - hash + tag.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function tagColorClass(tag: string): string {
  const idx = hashTag(tag) % TAG_COLORS.length;
  return TAG_COLORS[idx] ?? TAG_COLORS[0] ?? "";
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface TagEditorPopoverProps {
  documentId: string;
  currentTags: string[];
  /** All tags used across the project, for autocomplete suggestions */
  allProjectTags: string[];
  /** Trigger element — renders as a small icon button */
  children: React.ReactNode;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function TagEditorPopover({
  documentId,
  currentTags,
  allProjectTags,
  children,
}: TagEditorPopoverProps) {
  const [open, setOpen] = React.useState(false);
  const [tags, setTags] = React.useState<string[]>(currentTags);
  const [inputValue, setInputValue] = React.useState("");

  const triggerRef = React.useRef<HTMLDivElement>(null);
  const popoverRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const updateTags = useMutation(api.cms.documents.updateTags);

  // Sync tags when prop changes (e.g. external update)
  React.useEffect(() => {
    if (!open) {
      setTags(currentTags);
    }
  }, [currentTags, open]);

  // Focus input when popover opens
  React.useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  // Close on outside click
  React.useEffect(() => {
    if (!open) return;

    function handlePointerDown(e: PointerEvent) {
      const target = e.target as Node;
      if (
        popoverRef.current?.contains(target) ||
        triggerRef.current?.contains(target)
      ) {
        return;
      }
      setOpen(false);
    }

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [open]);

  // ---------------------------------------------------------------------------
  // Mutation helper
  // ---------------------------------------------------------------------------

  async function persistTags(nextTags: string[]) {
    try {
      await updateTags({
        documentId: documentId as Id<"documents">,
        tags: nextTags,
      });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to update tags.";
      toast.error(message);
    }
  }

  // ---------------------------------------------------------------------------
  // Tag actions
  // ---------------------------------------------------------------------------

  function addTag(raw: string) {
    const tag = raw.trim().toLowerCase().replace(/,/g, "");
    if (!tag || tags.includes(tag)) {
      setInputValue("");
      return;
    }
    const nextTags = [...tags, tag];
    setTags(nextTags);
    setInputValue("");
    void persistTags(nextTags);
  }

  function removeTag(tag: string) {
    const nextTags = tags.filter((t) => t !== tag);
    setTags(nextTags);
    void persistTags(nextTags);
  }

  // ---------------------------------------------------------------------------
  // Input handlers
  // ---------------------------------------------------------------------------

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addTag(inputValue);
    } else if (e.key === "Backspace" && inputValue === "" && tags.length > 0) {
      const last = tags[tags.length - 1];
      if (last !== undefined) {
        removeTag(last);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    // Strip commas as the user types so they don't accumulate
    setInputValue(e.target.value.replace(/,/g, ""));
  }

  // ---------------------------------------------------------------------------
  // Autocomplete suggestions
  // ---------------------------------------------------------------------------

  const trimmed = inputValue.trim().toLowerCase();

  const suggestions = allProjectTags.filter(
    (t) =>
      !tags.includes(t) &&
      (trimmed === "" || t.toLowerCase().includes(trimmed)),
  );

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="relative inline-flex" ref={triggerRef}>
      {/* Trigger */}
      <div
        role="button"
        tabIndex={0}
        aria-label="Edit tags"
        aria-expanded={open}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((prev) => !prev);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            e.stopPropagation();
            setOpen((prev) => !prev);
          }
        }}
      >
        {children}
      </div>

      {/* Popover */}
      {open && (
        <div
          ref={popoverRef}
          onClick={(e) => e.stopPropagation()}
          className={cn(
            "absolute bottom-full left-0 z-50 mb-1.5 w-64",
            "rounded-lg border border-border bg-popover shadow-md ring-1 ring-foreground/10",
            "p-3",
          )}
        >
          {/* Header */}
          <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Tag className="size-3" />
            Tags
          </div>

          {/* Existing tag badges */}
          {tags.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-1">
              {tags.map((tag) => (
                <span
                  key={tag}
                  className={cn(
                    "inline-flex items-center gap-0.5 rounded-md border px-1.5 py-0.5",
                    "text-[11px] font-medium",
                    tagColorClass(tag),
                  )}
                >
                  {tag}
                  <button
                    type="button"
                    aria-label={`Remove tag ${tag}`}
                    onClick={() => removeTag(tag)}
                    className="ml-0.5 rounded-sm opacity-60 hover:opacity-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    <X className="size-2.5" />
                  </button>
                </span>
              ))}
            </div>
          )}

          {/* Input row */}
          <div className="flex items-center gap-1.5">
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder="Add a tag…"
              className={cn(
                "h-7 min-w-0 flex-1 rounded-md border border-input bg-transparent px-2 text-xs",
                "placeholder:text-muted-foreground",
                "focus-visible:outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50",
                "transition-colors",
              )}
            />
            <button
              type="button"
              aria-label="Add tag"
              disabled={!inputValue.trim()}
              onClick={() => addTag(inputValue)}
              className={cn(
                "flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-input",
                "text-muted-foreground transition-colors",
                "hover:bg-accent hover:text-accent-foreground",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                "disabled:pointer-events-none disabled:opacity-40",
              )}
            >
              <Plus className="size-3.5" />
            </button>
          </div>

          {/* Autocomplete suggestions */}
          {suggestions.length > 0 && (
            <div className="mt-2 flex flex-col gap-0.5">
              <p className="mb-1 text-[10px] uppercase tracking-wide text-muted-foreground/70">
                Suggestions
              </p>
              {suggestions.slice(0, 6).map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => addTag(suggestion)}
                  className={cn(
                    "flex w-full items-center gap-1.5 rounded-md px-2 py-1 text-left text-xs",
                    "text-foreground transition-colors",
                    "hover:bg-accent hover:text-accent-foreground",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                  )}
                >
                  <span
                    className={cn(
                      "inline-flex items-center rounded border px-1.5 py-0 text-[10px] font-medium",
                      tagColorClass(suggestion),
                    )}
                  >
                    {suggestion}
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* Hint */}
          <p className="mt-2.5 text-[10px] text-muted-foreground/50">
            Press Enter or comma to add
          </p>
        </div>
      )}
    </div>
  );
}
