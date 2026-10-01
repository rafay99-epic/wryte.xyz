"use client";

import type { Id } from "@wryte/backend/_generated/dataModel";
import { useNotesViewStore } from "@wryte/logic/stores/notes-view-store";
import { Button } from "@wryte/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@wryte/ui/tooltip";
import { Link2, ListChecks, ListTodo, NotebookPen, Trash2 } from "lucide-react";
import { type ReactNode, useState } from "react";
import { useCreateNote } from "../hooks/use-create-note";
import { GroupFilter } from "./group-filter";
import { NoteSearch } from "./note-search";
import { SharedLinksDialog } from "./shared-links-dialog";
import { EmptyTrashButton } from "./trash-list";

export function BoardHeader({
  groupId,
  trash,
  count,
  selecting = false,
  onSelectingChange,
}: {
  groupId: Id<"note_groups"> | null;
  trash: boolean;
  count: string | null;
  selecting?: boolean;
  onSelectingChange?: (selecting: boolean) => void;
}) {
  const setTrash = useNotesViewStore((state) => state.setTrash);
  const createNote = useCreateNote();
  const [linksOpen, setLinksOpen] = useState(false);

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
        {onSelectingChange && (
          <IconButton
            label="Select notes"
            tooltip={selecting ? "Stop selecting" : "Select notes to share"}
            pressed={selecting}
            onClick={() => onSelectingChange(!selecting)}
          >
            <ListChecks />
          </IconButton>
        )}
        <IconButton
          label="Shared links"
          tooltip="Shared links"
          onClick={() => setLinksOpen(true)}
        >
          <Link2 />
        </IconButton>
        <IconButton
          label="Trash"
          tooltip={trash ? "Back to board" : "Trash"}
          pressed={trash}
          onClick={() => setTrash(!trash)}
        >
          <Trash2 />
        </IconButton>
      </div>
      <SharedLinksDialog open={linksOpen} onOpenChange={setLinksOpen} />
    </header>
  );
}

function IconButton({
  label,
  tooltip,
  pressed,
  onClick,
  children,
}: {
  label: string;
  tooltip: string;
  pressed?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            variant={pressed ? "secondary" : "ghost"}
            size="icon-lg"
            aria-label={label}
            aria-pressed={pressed}
            onClick={onClick}
          />
        }
      >
        {children}
      </TooltipTrigger>
      <TooltipContent side="bottom">{tooltip}</TooltipContent>
    </Tooltip>
  );
}
