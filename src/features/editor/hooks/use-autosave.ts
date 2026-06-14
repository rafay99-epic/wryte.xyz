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
  /**
   * Frequent, cheap persistence of the body. Runs on the debounce timer.
   * Should write ONLY the body (no metadata that invalidates list views).
   */
  onSave: (content: string, title: string) => Promise<void>;
  /**
   * Coarse, heavier save that also refreshes derived metadata (word count,
   * excerpt, updatedAt, stats). Runs on manual save and when leaving the
   * editor, so the board/sidebar reflect the session's final state without
   * being invalidated on every keystroke. Falls back to `onSave` when omitted.
   */
  onFlush?: (content: string, title: string) => Promise<void>;
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
  onFlush,
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
  const onFlushRef = useRef(onFlush);
  // True when the body has been autosaved (via onSave) since the last
  // metadata flush — so leaving the editor knows it still owes the
  // board/sidebar a metadata refresh even though nothing is "dirty".
  const flushPendingRef = useRef(false);
  // Monotonically increasing token per save attempt. After awaiting the
  // mutation we check that our token is still the latest; otherwise a newer
  // save kicked off mid-await and we drop the post-await side-effects to
  // avoid marking the editor as clean against stale content.
  const saveSeqRef = useRef(0);

  useEffect(() => {
    latestRef.current = { content, title, targetId };
  }, [content, title, targetId]);

  useEffect(() => {
    onSaveRef.current = onSave;
    onFlushRef.current = onFlush;
  }, [onSave, onFlush]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const performSave = useCallback(
    async (
      saveFn: (content: string, title: string) => Promise<void>,
    ): Promise<boolean> => {
      if (!isMountedRef.current) return false;
      if (latestRef.current.targetId !== targetId) return false;
      if (!useEditorStore.getState().isDirty) return false;

      const seq = ++saveSeqRef.current;
      const snapshotContent = latestRef.current.content;
      const snapshotTitle = latestRef.current.title;
      setSaving(true);
      try {
        await saveFn(snapshotContent, snapshotTitle);

        // A newer save started while we awaited — that call will handle the
        // result. Touching state here would mark the editor clean against
        // content the user has since moved past.
        if (seq !== saveSeqRef.current) return true;

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
        return true;
      } catch (err) {
        if (seq !== saveSeqRef.current) return false;
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
        return false;
      }
    },
    [targetId, setSaving, markSaved],
  );

  // Debounced periodic save — persists the body cheaply (no metadata churn).
  const save = useCallback(async () => {
    const saved = await performSave(onSaveRef.current);
    if (saved) flushPendingRef.current = true;
  }, [performSave]);

  // Terminal save (manual Cmd+S) — also refreshes derived metadata.
  const flush = useCallback(async () => {
    const saved = await performSave(onFlushRef.current ?? onSaveRef.current);
    if (saved) flushPendingRef.current = false;
  }, [performSave]);

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
      const { content: c, title: t } = latestRef.current;
      const flushFn = onFlushRef.current ?? onSaveRef.current;
      // Leaving with unsaved edits → full save. Otherwise, if the body was
      // autosaved but the documents row hasn't had its metadata refreshed
      // yet, flush it now so the board/sidebar reflect the final state.
      if (hasPendingTimer && state.isDirty) {
        void flushFn(c, t).catch((err) => {
          console.error("[Autosave] Flush-on-unmount failed:", err);
        });
      } else if (flushPendingRef.current) {
        flushPendingRef.current = false;
        void flushFn(c, t).catch((err) => {
          console.error("[Autosave] Metadata flush-on-unmount failed:", err);
        });
      }
    };
  }, [enabled]);

  const saveNow = useCallback(async () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    await flush();
  }, [flush]);

  return { isSaving, lastSavedAt, saveNow };
}
