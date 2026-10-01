"use client";

import type { Id } from "@wryte/backend/_generated/dataModel";
import { useNotesViewStore } from "@wryte/logic/stores/notes-view-store";
import { Button } from "@wryte/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@wryte/ui/tooltip";
import { ListTodo, NotebookPen, Trash2 } from "lucide-react";
import { useCreateNote } from "../hooks/use-create-note";
import { GroupFilter } from "./group-filter";
import { NoteSearch } from "./note-search";
import { EmptyTrashButton } from "./trash-list";

export function BoardHeader({
  groupId,
  trash,
  count,
}: {
  groupId: Id<"note_groups"> | null;
  trash: boolean;
  count: string | null;
}) {
  const setTrash = useNotesViewStore((state) => state.setTrash);
  const createNote = useCreateNote();

  return (
    <header className="@container flex shrink-0 flex-wrap items-center gap-3 px-6 pt-5 pb-4">
      <div className="flex min-w-0 items-center gap-3">
        <h1 className="text-lg font-semibold text-foreground">
          {trash ? "Trash" : "Notes"}
        </h1>
        {count !== null && (
          <span className="text-sm text-muted-foreground tabular-nums">
            {count}
          </span>
        )}
        {!trash && <GroupFilter groupId={groupId} />}
      </div>
      <div className="ml-auto flex min-w-0 items-center gap-3">
        <NoteSearch />
        {trash ? (
          <EmptyTrashButton />
        ) : (
          <>
            <Button
              variant="outline"
              size="lg"
              aria-label="New note"
              onClick={() => void createNote("notes", groupId)}
            >
              <NotebookPen />
              <span className="@max-3xl:hidden">New note</span>
            </Button>
            <Button
              size="lg"
              aria-label="New task"
              onClick={() => void createNote("todo", groupId)}
            >
              <ListTodo />
              <span className="@max-3xl:hidden">New task</span>
            </Button>
          </>
        )}
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant={trash ? "secondary" : "ghost"}
                size="icon-lg"
                aria-label="Trash"
                aria-pressed={trash}
                onClick={() => setTrash(!trash)}
              />
            }
          >
            <Trash2 />
          </TooltipTrigger>
          <TooltipContent side="bottom">
            {trash ? "Back to board" : "Trash"}
          </TooltipContent>
        </Tooltip>
      </div>
    </header>
  );
}
