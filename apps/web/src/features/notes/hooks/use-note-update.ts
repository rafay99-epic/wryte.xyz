import { api } from "@wryte/backend/_generated/api";
import type { Id } from "@wryte/backend/_generated/dataModel";
import type { NoteStatus } from "@wryte/backend/cms/notes/_lib/model";
import { EDITOR_SESSION_ID } from "@wryte/logic/lib/editor/session";
import { useMutation } from "convex/react";
import type { FunctionArgs } from "convex/server";
import { useCallback } from "react";
import { toast } from "sonner";

export type NoteUpdate = Omit<
  FunctionArgs<typeof api.cms.notes.notes.update>,
  "writer"
>;

export function useNoteUpdate() {
  const update = useMutation(api.cms.notes.notes.update);
  return useCallback(
    async (args: NoteUpdate) => {
      try {
        await update({ ...args, writer: EDITOR_SESSION_ID });
      } catch (error) {
        console.error("[Notes] Update failed:", error);
        toast.error("Couldn't update the note");
      }
    },
    [update],
  );
}

export function useNoteRowActions() {
  const update = useNoteUpdate();
  const onStatusChange = useCallback(
    (noteId: Id<"notes">, status: NoteStatus) => {
      void update({ noteId, status });
    },
    [update],
  );
  const onDueChange = useCallback(
    (noteId: Id<"notes">, dueDate: string | null) => {
      void update({ noteId, dueDate });
    },
    [update],
  );
  return { onStatusChange, onDueChange };
}

export type NoteRowActions = ReturnType<typeof useNoteRowActions>;
