import { useCallback, useEffect, useRef } from "react";
import { toast } from "sonner";
import { useShallow } from "zustand/react/shallow";
import { useEditorStore } from "@/stores/editor-store";

const DEBOUNCE_MS = 3000;
const FAILURE_THRESHOLD = 3;

type AutosaveOptions = {
  targetId: string;
  content: string;
  title: string;
  onSave: (content: string, title: string) => Promise<void>;
  enabled?: boolean;
};

type AutosaveReturn = {
  isSaving: boolean;
  lastSavedAt: number | null;
  saveNow: () => Promise<void>;
};

export function useAutosave({
  targetId,
  content,
  title,
  onSave,
  enabled = true,
}: AutosaveOptions): AutosaveReturn {
  const { isSaving, lastSavedAt, isDirty, setSaving, markSaved } =
    useEditorStore(
      useShallow((state) => ({
        isSaving: state.isSaving,
        lastSavedAt: state.lastSavedAt,
        isDirty: state.isDirty,
        setSaving: state.setSaving,
        markSaved: state.markSaved,
      })),
    );

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestRef = useRef({ content, title, targetId });
  const isMountedRef = useRef(true);
  const failureCountRef = useRef(0);
  const onSaveRef = useRef(onSave);

  useEffect(() => {
    latestRef.current = { content, title, targetId };
  }, [content, title, targetId]);

  useEffect(() => {
    onSaveRef.current = onSave;
  }, [onSave]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const save = useCallback(async () => {
    if (!isMountedRef.current) return;
    if (latestRef.current.targetId !== targetId) return;
    if (!useEditorStore.getState().isDirty) return;

    const snapshotContent = latestRef.current.content;
    const snapshotTitle = latestRef.current.title;
    setSaving(true);
    try {
      await onSaveRef.current(snapshotContent, snapshotTitle);

      if (isMountedRef.current && latestRef.current.targetId === targetId) {
        const stillFresh =
          latestRef.current.content === snapshotContent &&
          latestRef.current.title === snapshotTitle;
        if (stillFresh) {
          markSaved();
        } else {
          setSaving(false);
        }
        failureCountRef.current = 0;
      }
    } catch (err) {
      if (isMountedRef.current) {
        setSaving(false);
        failureCountRef.current += 1;
        console.error("[Autosave] Failed to save:", err);
        if (failureCountRef.current === FAILURE_THRESHOLD) {
          toast.error("Unable to save — check your connection", {
            id: "autosave-failure",
            duration: 5000,
          });
        }
      }
    }
  }, [targetId, setSaving, markSaved]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: content & title are intentional re-trigger signals
  useEffect(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    if (!enabled) return;
    if (!isDirty) return;
    timerRef.current = setTimeout(() => {
      void save();
    }, DEBOUNCE_MS);
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [content, title, isDirty, save, enabled]);

  useEffect(() => {
    return () => {
      if (!enabled) return;
      const hasPendingTimer = timerRef.current !== null;
      const state = useEditorStore.getState();
      if (!hasPendingTimer || !state.isDirty) return;
      const { content: c, title: t } = latestRef.current;
      void onSaveRef.current(c, t).catch((err) => {
        console.error("[Autosave] Flush-on-unmount failed:", err);
      });
    };
  }, [enabled]);

  const saveNow = useCallback(async () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    await save();
  }, [save]);

  return { isSaving, lastSavedAt, saveNow };
}
