import type { Id } from "@wryte/backend/_generated/dataModel";
import { MAX_SHARE_NOTES } from "@wryte/backend/cms/notes/_lib/shareModel";
import { useCallback, useState } from "react";

const EMPTY: ReadonlySet<Id<"notes">> = new Set();

export function useNoteSelection() {
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<ReadonlySet<Id<"notes">>>(EMPTY);

  const toggle = useCallback((noteId: Id<"notes">) => {
    setSelecting(true);
    setSelected((prev) => {
      if (prev.has(noteId)) {
        const next = new Set(prev);
        next.delete(noteId);
        return next;
      }
      if (prev.size >= MAX_SHARE_NOTES) return prev;
      return new Set(prev).add(noteId);
    });
  }, []);

  const clear = useCallback(() => setSelected(EMPTY), []);

  const setMode = useCallback((next: boolean) => {
    setSelecting(next);
    if (!next) setSelected(EMPTY);
  }, []);

  return {
    selecting,
    selected,
    full: selected.size >= MAX_SHARE_NOTES,
    toggle,
    clear,
    setMode,
  };
}
