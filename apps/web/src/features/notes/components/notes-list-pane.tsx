"use client";

import { api } from "@wryte/backend/_generated/api";
import {
  isTaskView,
  type NotesView,
  viewLabel,
} from "@wryte/logic/lib/notes/views";
import { useNotesViewStore } from "@wryte/logic/stores/notes-view-store";
import { Button } from "@wryte/ui/button";
import { useMutation } from "convex/react";
import { PanelLeft, Plus, Trash2 } from "lucide-react";
import { useParams } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { ConfirmActionDialog } from "@/components/settings/confirm-action-dialog";
import { useCreateNote } from "../hooks/use-create-note";
import { useNotesRailData } from "../hooks/use-notes-rail";
import { PagedNotesList } from "./paged-notes-list";
import { TasksList } from "./tasks-list";
import { TrashList } from "./trash-list";

export function NotesListHeaderFallback() {
  return <div className="h-11 shrink-0 border-b border-border/50" />;
}

export function NotesListPane({
  view,
  today,
}: {
  view: NotesView;
  today: string;
}) {
  const params = useParams<{ noteId?: string }>();
  const selectedId = params.noteId ?? null;
  const { groupsById } = useNotesRailData();
  const setNavOpen = useNotesViewStore((state) => state.setNavOpen);
  const createNote = useCreateNote();
  const kind = isTaskView(view) ? "task" : "note";

  return (
    <>
      <header className="flex h-11 shrink-0 items-center gap-1 border-b border-border/50 px-2">
        <Button
          variant="ghost"
          size="icon-sm"
          className="lg:hidden"
          aria-label="Show note views"
          onClick={() => setNavOpen(true)}
        >
          <PanelLeft />
        </Button>
        <h1 className="min-w-0 flex-1 truncate px-1 text-sm font-semibold text-foreground">
          {viewLabel(view, groupsById)}
        </h1>
        {view.kind === "trash" ? (
          <EmptyTrashButton />
        ) : (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => void createNote(view, kind)}
          >
            <Plus />
            {kind === "task" ? "New task" : "New note"}
          </Button>
        )}
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto slim-scrollbar">
        <ViewList view={view} selectedId={selectedId} today={today} />
      </div>
    </>
  );
}

function ViewList({
  view,
  selectedId,
  today,
}: {
  view: NotesView;
  selectedId: string | null;
  today: string;
}) {
  switch (view.kind) {
    case "tasks":
    case "today":
      return (
        <TasksList mode={view.kind} selectedId={selectedId} today={today} />
      );
    case "trash":
      return <TrashList />;
    case "group":
      return (
        <PagedNotesList
          key={view.groupId}
          groupId={view.groupId}
          pinnedOnly={false}
          selectedId={selectedId}
          today={today}
        />
      );
    case "all":
    case "pinned":
      return (
        <PagedNotesList
          groupId={undefined}
          pinnedOnly={view.kind === "pinned"}
          selectedId={selectedId}
          today={today}
        />
      );
  }
}

function EmptyTrashButton() {
  const emptyTrash = useMutation(api.cms.notes.notes.emptyTrash);
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        className="text-destructive hover:text-destructive"
        onClick={() => setOpen(true)}
      >
        <Trash2 />
        Empty trash
      </Button>
      <ConfirmActionDialog
        open={open}
        onOpenChange={setOpen}
        title="Empty trash?"
        description="Every note in the trash will be deleted. This cannot be undone."
        confirmLabel="Empty trash"
        onConfirm={() => {
          emptyTrash({}).catch(() => {
            toast.error("Couldn't empty the trash");
          });
        }}
      />
    </>
  );
}
