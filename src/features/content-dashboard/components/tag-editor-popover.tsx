"use client";

import { Plus, Tag, X } from "lucide-react";
import * as React from "react";

import { useTagEditor } from "@/features/content-dashboard/hooks/use-tag-editor";
import { getTagColor } from "@/lib/tag-colors";
import { cn } from "@/lib/utils";

type TagEditorPopoverProps = {
  documentId: string;
  currentTags: string[];
  allProjectTags: string[];
  children: React.ReactNode;
};

export function TagEditorPopover({
  documentId,
  currentTags,
  allProjectTags,
  children,
}: TagEditorPopoverProps) {
  const [open, setOpen] = React.useState(false);

  const triggerRef = React.useRef<HTMLDivElement>(null);
  const popoverRef = React.useRef<HTMLDivElement>(null);

  const editor = useTagEditor({ documentId, initialTags: currentTags });

  // Sync tags when prop changes (e.g. external update)
  React.useEffect(() => {
    if (!open) {
      editor.resetTags(currentTags);
    }
  }, [currentTags, open, editor.resetTags]);

  // Focus input when popover opens
  React.useEffect(() => {
    if (open) {
      setTimeout(() => editor.inputRef.current?.focus(), 0);
    }
  }, [open, editor.inputRef]);

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

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    editor.setInputValue(e.target.value.replace(/,/g, ""));
  }

  const trimmed = editor.inputValue.trim().toLowerCase();

  const suggestions = allProjectTags.filter(
    (t) =>
      !editor.tags.includes(t) &&
      (trimmed === "" || t.toLowerCase().includes(trimmed)),
  );

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
          {editor.tags.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-1">
              {editor.tags.map((tag) => (
                <span
                  key={tag}
                  className={cn(
                    "inline-flex items-center gap-0.5 rounded-md border px-1.5 py-0.5",
                    "text-[11px] font-medium",
                    getTagColor(tag).badge,
                  )}
                >
                  {tag}
                  <button
                    type="button"
                    aria-label={`Remove tag ${tag}`}
                    onClick={() => editor.removeTag(tag)}
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
              ref={editor.inputRef}
              type="text"
              value={editor.inputValue}
              onChange={handleInputChange}
              onKeyDown={(e) => {
                editor.handleKeyDown(e);
                if (e.key === "Escape") setOpen(false);
              }}
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
              disabled={!editor.inputValue.trim()}
              onClick={() => editor.addTag(editor.inputValue)}
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
                  onClick={() => editor.addTag(suggestion)}
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
                      getTagColor(suggestion).badge,
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
