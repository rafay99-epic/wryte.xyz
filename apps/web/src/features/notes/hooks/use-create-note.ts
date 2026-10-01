import { api } from "@wryte/backend/_generated/api";
import type { Id } from "@wryte/backend/_generated/dataModel";
import type { BoardColumn } from "@wryte/backend/cms/notes/_lib/model";
import { newNoteArgs } from "@wryte/logic/lib/notes/views";
import { useMutation } from "convex/react";
import { useCallback } from "react";
import { toast } from "sonner";
import { useOpenNote } from "./use-open-note";

export function useCreateNote() {
  const open = useOpenNote();
  const create = useMutation(api.cms.notes.notes.create);
  return useCallback(
    async (column: BoardColumn, groupId: Id<"note_groups"> | null = null) => {
      try {
        open(await create(newNoteArgs(column, groupId)));
      } catch (error) {
        console.error("[Notes] Create failed:", error);
        toast.error(
          column === "notes"
            ? "Couldn't create the note"
            : "Couldn't create the task",
        );
      }
    },
    [create, open],
  );
}
