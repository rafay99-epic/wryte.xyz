"use client";

import { CONTENT_SEARCH_DEBOUNCE_MS } from "@wryte/backend/cms/_lib/documentContent";
import { useDebouncedValue } from "@wryte/logic/hooks/use-debounced-value";
import { useIsMacPlatform } from "@wryte/logic/hooks/use-is-mac-platform";
import { MIN_NOTE_SEARCH_TERM } from "@wryte/logic/lib/notes/views";
import { splitShortcutKeys } from "@wryte/logic/lib/shortcuts";
import { cn } from "@wryte/logic/lib/utils";
import { useShortcutsStore } from "@wryte/logic/stores/shortcuts-store";
import { KbdGroup } from "@wryte/ui/kbd";
import { Search } from "lucide-react";
import { type KeyboardEvent, useId, useState } from "react";
import { useNoteSearch } from "@/features/command-palette/hooks/use-note-search";
import { useOpenNote } from "../hooks/use-open-note";
import { StatusIcon } from "./status-icon";

export function NoteSearch() {
  const open = useOpenNote();
  const listId = useId();
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const [active, setActive] = useState(0);
  const term = useDebouncedValue(query.trim(), CONTENT_SEARCH_DEBOUNCE_MS);
  const searchable = term.length >= MIN_NOTE_SEARCH_TERM;
  const hits = useNoteSearch(searchable ? term : "");
  const showResults = focused && searchable;
  const results = hits ?? [];
  const activeIndex = Math.min(active, Math.max(0, results.length - 1));
  const isMac = useIsMacPlatform();
  const paletteShortcut = useShortcutsStore((state) =>
    state.getKeys("commandPalette"),
  );

  function pick(noteId: string) {
    open(noteId);
    setQuery("");
    setFocused(false);
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      if (query) setQuery("");
      else event.currentTarget.blur();
      return;
    }
    if (!showResults || results.length === 0) return;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const step = event.key === "ArrowDown" ? 1 : -1;
      setActive((activeIndex + step + results.length) % results.length);
    } else if (event.key === "Enter") {
      event.preventDefault();
      const hit = results[activeIndex];
      if (hit) pick(hit.noteId);
    }
  }

  const activeHit = showResults ? results[activeIndex] : undefined;

  return (
    <div className="relative w-[280px] max-w-full">
      <Search
        aria-hidden
        className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
      />
      <input
        type="search"
        role="combobox"
        aria-label="Search notes"
        aria-expanded={showResults}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={
          activeHit ? `${listId}-${activeHit.noteId}` : undefined
        }
        value={query}
        placeholder="Search notes"
        onChange={(event) => {
          setQuery(event.target.value);
          setActive(0);
        }}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onKeyDown={onKeyDown}
        className="h-9 w-full rounded-lg border border-white/10 bg-white/5 pr-14 pl-9 text-sm text-foreground outline-none transition-colors duration-150 placeholder:text-muted-foreground focus:border-white/25 focus:ring-2 focus:ring-white/10 [&::-webkit-search-cancel-button]:hidden"
      />
      {!query && (
        <KbdGroup
          keys={splitShortcutKeys(paletteShortcut, isMac)}
          className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2"
        />
      )}
      {showResults && (
        <div
          id={listId}
          role="listbox"
          aria-label="Matching notes"
          className="absolute top-full right-0 left-0 z-50 mt-2 max-h-96 overflow-y-auto rounded-xl border border-white/10 bg-[#0c0c0d] p-1.5 shadow-2xl shadow-black/60 slim-scrollbar"
        >
          {hits === undefined ? (
            <p className="px-2.5 py-2 text-xs text-muted-foreground">
              Searching
            </p>
          ) : results.length === 0 ? (
            <p className="px-2.5 py-2 text-xs text-muted-foreground">
              No matching notes
            </p>
          ) : (
            results.map((hit, index) => (
              <div
                key={hit.noteId}
                id={`${listId}-${hit.noteId}`}
                role="option"
                tabIndex={-1}
                aria-selected={index === activeIndex}
                onMouseDown={(event) => event.preventDefault()}
                onMouseEnter={() => setActive(index)}
                onClick={() => pick(hit.noteId)}
                className={cn(
                  "flex cursor-pointer items-start gap-2.5 rounded-lg px-2.5 py-2",
                  index === activeIndex && "bg-white/[0.06]",
                )}
              >
                <StatusIcon
                  status={hit.status ?? "notes"}
                  className="mt-0.5 shrink-0"
                />
                <span className="min-w-0 flex-1">
                  <span
                    className={cn(
                      "block truncate text-sm",
                      hit.title
                        ? "text-foreground"
                        : "text-muted-foreground italic",
                    )}
                  >
                    {hit.title || "Untitled"}
                  </span>
                  {hit.snippet && (
                    <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                      {hit.snippet}
                    </span>
                  )}
                </span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
