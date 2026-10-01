import { api } from "@wryte/backend/_generated/api";
import { todayKey } from "@wryte/logic/lib/notes/dates";
import {
  type NoteKind,
  type NotesView,
  newNoteArgs,
  notePath,
} from "@wryte/logic/lib/notes/views";
import { useMutation } from "convex/react";
import { useRouter } from "next/navigation";
import { useCallback } from "react";
import { toast } from "sonner";

export function useCreateNote() {
  const router = useRouter();
  const create = useMutation(api.cms.notes.notes.create);
  return useCallback(
    async (view: NotesView, kind: NoteKind) => {
      try {
        const noteId = await create(newNoteArgs(view, kind, todayKey()));
        router.push(notePath(noteId));
      } catch (error) {
        console.error("[Notes] Create failed:", error);
        toast.error(
          kind === "task"
            ? "Couldn't create the task"
            : "Couldn't create the note",
        );
      }
    },
    [create, router],
  );
}
