"use client";

import { todayKey } from "@wryte/logic/lib/notes/dates";
import { noteIdFromPath, resolveGroupId } from "@wryte/logic/lib/notes/views";
import { cn } from "@wryte/logic/lib/utils";
import { useNotesViewStore } from "@wryte/logic/stores/notes-view-store";
import { usePathname } from "next/navigation";
import { type ReactNode, useCallback, useState } from "react";
import { BoardHeader } from "./components/board-header";
import { NotePanel } from "./components/note-panel";
import { NotesBoard } from "./components/notes-board";
import { TrashList } from "./components/trash-list";
import { NotesRailContext, useNotesRail } from "./hooks/use-notes-rail";
import { useOpenNote } from "./hooks/use-open-note";

export function NotesShell({ children }: { children: ReactNode }) {
  const railData = useNotesRail();
  const selectedId = noteIdFromPath(usePathname());
  const open = useOpenNote();
  const close = useCallback(() => open(null), [open]);
  const storedGroupId = useNotesViewStore((state) => state.groupId);
  const trash = useNotesViewStore((state) => state.trash);
  const groupId = resolveGroupId(storedGroupId, railData.groupsById);
  const [today] = useState(todayKey);

  return (
    <NotesRailContext value={railData}>
      <div className="flex h-full min-h-0 overflow-hidden bg-background">
        <section
          aria-label="Notes board"
          className={cn(
            "flex min-w-0 flex-1 flex-col",
            selectedId && "max-lg:hidden",
          )}
        >
          {trash ? (
            <>
              <BoardHeader groupId={groupId} trash count={null} />
              <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-6 slim-scrollbar">
                <TrashList />
              </div>
            </>
          ) : (
            <NotesBoard
              key={groupId ?? "all"}
              groupId={groupId}
              selectedId={selectedId}
              today={today}
            />
          )}
        </section>
        {selectedId && (
          <aside
            aria-label="Note"
            className="flex min-h-0 w-full min-w-0 shrink-0 flex-col overflow-hidden lg:w-[480px] lg:border-l lg:border-white/[0.08] xl:w-[560px]"
          >
            <NotePanel noteId={selectedId} onClose={close} />
          </aside>
        )}
        {children}
      </div>
    </NotesRailContext>
  );
}
