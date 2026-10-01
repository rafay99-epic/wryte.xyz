"use client";

import { todayKey } from "@wryte/logic/lib/notes/dates";
import { resolveView } from "@wryte/logic/lib/notes/views";
import { cn } from "@wryte/logic/lib/utils";
import { useNotesViewStore } from "@wryte/logic/stores/notes-view-store";
import { type ReactNode, Suspense, useState } from "react";
import {
  NotesListHeaderFallback,
  NotesListPane,
} from "./components/notes-list-pane";
import { NotesRail } from "./components/notes-rail";
import { NotesRailContext, useNotesRail } from "./hooks/use-notes-rail";

const NOTE_OPEN = "max-lg:group-has-[[data-note-open]]/notes:hidden";

export function NotesShell({ children }: { children: ReactNode }) {
  const railData = useNotesRail();
  const storedView = useNotesViewStore((state) => state.view);
  const navOpen = useNotesViewStore((state) => state.navOpen);
  const view = resolveView(storedView, railData.groupsById);
  const [today] = useState(todayKey);

  return (
    <NotesRailContext value={railData}>
      <div className="group/notes flex h-full min-h-0 overflow-hidden bg-background">
        <nav
          aria-label="Note views"
          className={cn(
            "flex w-52 shrink-0 flex-col border-r border-border/50",
            navOpen ? "max-lg:w-full max-lg:border-r-0" : "max-lg:hidden",
            NOTE_OPEN,
          )}
        >
          <NotesRail view={view} />
        </nav>
        <section
          aria-label="Notes"
          className={cn(
            "flex w-80 shrink-0 flex-col border-r border-border/50",
            navOpen ? "max-lg:hidden" : "max-lg:w-full max-lg:border-r-0",
            NOTE_OPEN,
          )}
        >
          <Suspense fallback={<NotesListHeaderFallback />}>
            <NotesListPane view={view} today={today} />
          </Suspense>
        </section>
        <section
          aria-label="Note"
          className="flex min-w-0 flex-1 flex-col max-lg:hidden max-lg:group-has-[[data-note-open]]/notes:flex"
        >
          {children}
        </section>
      </div>
    </NotesRailContext>
  );
}
