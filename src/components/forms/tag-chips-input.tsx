"use client";

import { X } from "lucide-react";
import { useCallback, useId, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";

type TagChipsInputProps = {
  id?: string;
  /**
   * Comma-separated string that the rest of the editor already round-trips
   * through. The chip UI is purely a presentation layer over this value, so
   * frontmatter serialization keeps working unchanged.
   */
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  /** Disallow duplicates (case-insensitive). Defaults to true. */
  dedupe?: boolean;
};

/**
 * Chip-style tag input. Type a value and press Enter or comma to lock it in
 * as a pill; click the × on a pill (or backspace from an empty input) to
 * remove it. Stored value stays as a comma-separated string so existing
 * serialization, YAML round-trips, and `tags`/`list`/`multiselect` consumers
 * don't have to change.
 */
export function TagChipsInput({
  id,
  value,
  onChange,
  placeholder,
  className,
  dedupe = true,
}: TagChipsInputProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const inputRef = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState("");

  const chips = useMemo(
    () =>
      value
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    [value],
  );

  const writeChips = useCallback(
    (next: string[]) => {
      onChange(next.join(", "));
    },
    [onChange],
  );

  const commitDraft = useCallback(() => {
    const candidate = draft.trim().replace(/,$/, "").trim();
    if (!candidate) {
      setDraft("");
      return;
    }
    const exists =
      dedupe && chips.some((c) => c.toLowerCase() === candidate.toLowerCase());
    if (!exists) writeChips([...chips, candidate]);
    setDraft("");
  }, [chips, dedupe, draft, writeChips]);

  const removeAt = useCallback(
    (index: number) => {
      writeChips(chips.filter((_, i) => i !== index));
    },
    [chips, writeChips],
  );

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) inputRef.current?.focus();
      }}
      className={cn(
        "flex min-h-9 w-full flex-wrap items-center gap-1.5 rounded-md border border-input bg-transparent px-2 py-1.5 text-left text-sm transition-colors focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/30 dark:bg-input/30",
        className,
      )}
    >
      {chips.map((chip, index) => (
        <span
          key={`${chip}-${index}`}
          className="inline-flex items-center gap-1 rounded-md border border-border/60 bg-muted/60 py-0.5 pl-2 pr-1 text-xs text-foreground"
        >
          {chip}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              removeAt(index);
            }}
            className="rounded-sm p-0.5 text-muted-foreground transition-colors hover:bg-destructive/15 hover:text-destructive"
            aria-label={`Remove ${chip}`}
          >
            <X className="size-3" />
          </button>
        </span>
      ))}
      <input
        ref={inputRef}
        id={inputId}
        value={draft}
        onChange={(e) => {
          const next = e.target.value;
          if (next.includes(",")) {
            const parts = next.split(",");
            const last = parts.pop() ?? "";
            const additions = parts.map((p) => p.trim()).filter(Boolean);
            if (additions.length) {
              const seen = new Set(
                dedupe ? chips.map((c) => c.toLowerCase()) : [],
              );
              const next: string[] = [...chips];
              for (const add of additions) {
                if (dedupe && seen.has(add.toLowerCase())) continue;
                next.push(add);
                seen.add(add.toLowerCase());
              }
              writeChips(next);
            }
            setDraft(last);
          } else {
            setDraft(next);
          }
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commitDraft();
          } else if (e.key === "Backspace" && !draft && chips.length > 0) {
            e.preventDefault();
            removeAt(chips.length - 1);
          }
        }}
        onBlur={commitDraft}
        placeholder={chips.length === 0 ? placeholder : ""}
        className="min-w-[6rem] flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/50"
      />
    </div>
  );
}
