"use client";

import { useNotesViewStore } from "@wryte/logic/stores/notes-view-store";
import { Button } from "@wryte/ui/button";
import { ListTodo, NotebookPen } from "lucide-react";
import { useCreateNote } from "../hooks/use-create-note";

export function NotesEmptyPane() {
  const view = useNotesViewStore((state) => state.view);
  const createNote = useCreateNote();

  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 p-6">
      <p className="text-sm text-muted-foreground">No note open</p>
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => void createNote(view, "note")}
        >
          <NotebookPen />
          New note
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => void createNote(view, "task")}
        >
          <ListTodo />
          New task
        </Button>
      </div>
    </div>
  );
}
