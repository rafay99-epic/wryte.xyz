import { api } from "@wryte/backend/_generated/api";
import type { Id } from "@wryte/backend/_generated/dataModel";
import { useAuthedQuery } from "@wryte/logic/hooks/use-authed-query";
import type { BodySnapshot } from "@wryte/logic/lib/editor/body-sync";
import type { NoteEditorTarget } from "@wryte/logic/lib/editor/features";
import { EDITOR_SESSION_ID } from "@wryte/logic/lib/editor/session";
import { useEditorStore } from "@wryte/logic/stores/editor-store";
import { useConvex, useConvexAuth, useMutation } from "convex/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useShallow } from "zustand/react/shallow";
import {
  type SaveOptions,
  useAutosave,
} from "@/features/editor/hooks/use-autosave";
import { useBodySync } from "@/features/editor/hooks/use-body-sync";
import { useSaveShortcut } from "@/features/editor/hooks/use-save-shortcut";

export function useNoteEditor(noteId: Id<"notes">) {
  const convex = useConvex();
  const { isAuthenticated } = useConvexAuth();
  const meta = useAuthedQuery(api.cms.notes.notes.getMeta, { noteId });
  const saveNote = useMutation(api.cms.notes.notes.save);

  const fetchBody = useCallback(
    (): Promise<BodySnapshot | null> =>
      convex.query(api.cms.notes.notes.getBody, { noteId }),
    [convex, noteId],
  );

  const sync = useBodySync({
    targetId: noteId,
    meta,
    fetchBody,
    enabled: isAuthenticated,
  });

  const target = useMemo<NoteEditorTarget>(
    () => ({ kind: "note", noteId }),
    [noteId],
  );

  const { content, title, isDirty, initDocument, syncTitle, reset } =
    useEditorStore(
      useShallow((state) => ({
        content: state.content,
        title: state.title,
        isDirty: state.isDirty,
        initDocument: state.initDocument,
        syncTitle: state.syncTitle,
        reset: state.reset,
      })),
    );

  const bodyApplied = useEditorStore(
    (state) => state.target?.kind === "note" && state.target.noteId === noteId,
  );

  const titleRef = useRef(meta?.title ?? "");
  useEffect(() => {
    if (meta) titleRef.current = meta.title;
  }, [meta]);

  useEffect(() => {
    if (bodyApplied || !meta || !sync.body) return;
    initDocument(meta.title, sync.body.content, target);
  }, [bodyApplied, meta, sync.body, initDocument, target]);

  useEffect(() => {
    return () => {
      reset();
    };
  }, [reset]);

  const applyBody = useCallback(
    (body: BodySnapshot, force: boolean): boolean => {
      const state = useEditorStore.getState();
      if (!force && state.isDirty) return false;
      if (
        state.isDirty ||
        state.content !== body.content ||
        state.title !== titleRef.current
      ) {
        initDocument(titleRef.current, body.content, target);
      }
      return true;
    },
    [initDocument, target],
  );

  const { externalChange, reload } = sync;
  useEffect(() => {
    if (!bodyApplied || !externalChange || isDirty) return;
    reload((body) => applyBody(body, false)).catch((error: unknown) => {
      console.error("[Notes] Failed to reload changed body:", error);
    });
  }, [bodyApplied, externalChange, isDirty, reload, applyBody]);

  useEffect(() => {
    if (!bodyApplied || !meta || isDirty) return;
    if (meta.title.trim() !== title.trim()) syncTitle(meta.title);
  }, [bodyApplied, meta, isDirty, title, syncTitle]);

  const [dismissedRev, setDismissedRev] = useState<number | null>(null);
  const metaRev = meta?.rev ?? 0;
  const showExternalChange =
    bodyApplied && externalChange && isDirty && dismissedRev !== metaRev;

  const baseRevRef = useRef(0);
  useEffect(() => {
    baseRevRef.current = Math.max(sync.rev ?? 0, dismissedRev ?? 0);
  }, [sync.rev, dismissedRev]);

  const reloadExternal = useCallback(() => {
    reload((body) => applyBody(body, true)).catch(() => {
      toast.error("Couldn't reload the note. Try again.");
    });
  }, [reload, applyBody]);

  const dismissExternal = useCallback(() => {
    setDismissedRev(metaRev);
  }, [metaRev]);

  const onSave = useCallback(
    async (c: string, t: string, { flush, contentChanged }: SaveOptions) => {
      await saveNote({
        noteId,
        ...(flush && !contentChanged ? {} : { content: c }),
        title: t,
        writer: EDITOR_SESSION_ID,
        baseRev: baseRevRef.current,
        ...(flush ? { flush: true } : {}),
      });
    },
    [noteId, saveNote],
  );

  const { saveNow, flushNow } = useAutosave({
    targetId: noteId,
    content,
    title,
    onSave,
    enabled: bodyApplied && !showExternalChange,
    flushWhenHidden: true,
  });

  const saveShortcut = useCallback(() => {
    saveNow().catch(() => {
      toast.error("Save failed", { id: "note-save" });
    });
  }, [saveNow]);
  useSaveShortcut(saveShortcut);

  useEffect(() => {
    function handleBeforeUnload(event: BeforeUnloadEvent) {
      if (useEditorStore.getState().isDirty) event.preventDefault();
    }
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, []);

  const handleBlur = useCallback(() => {
    void flushNow();
  }, [flushNow]);

  return {
    meta,
    handleBlur,
    missing: meta === null || sync.body === null,
    ready: bodyApplied && meta != null,
    target,
    showExternalChange,
    reloadExternal,
    dismissExternal,
    flushNow,
  };
}
