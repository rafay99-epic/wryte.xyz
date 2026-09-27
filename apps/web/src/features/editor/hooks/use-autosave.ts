import {
  clearRecovery,
  readRecovery,
  writeRecovery,
} from "@wryte/logic/lib/editor/recovery-buffer";
import { useEditorStore } from "@wryte/logic/stores/editor-store";
import { useCallback, useEffect, useRef } from "react";
import { toast } from "sonner";
import { useShallow } from "zustand/react/shallow";

const DEBOUNCE_MS = 3000;
const RECOVERY_WRITE_MS = 2000;
const MAX_WAIT_MS = 30_000;
const FAILURE_THRESHOLD = 3;

type AutosaveOptions = {
  targetId: string;
  content: string;
  title: string;
  onSave: (content: string, title: string) => Promise<void>;
  onFlush?: (content: string, title: string) => Promise<void>;
  enabled?: boolean;
};

type AutosaveReturn = {
  isSaving: boolean;
  lastSavedAt: number | null;
  saveNow: () => Promise<void>;
};

type SavedSnapshot = { targetId: string; content: string; title: string };

type SaveResult = {
  committed: boolean;
  wrote: boolean;
};

const NOOP_RESULT: SaveResult = { committed: false, wrote: false };

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
  const flushPendingRef = useRef(false);
  const saveSeqRef = useRef(0);
  const lastSavedRef = useRef<SavedSnapshot>({ content, title, targetId });
  const firstDirtyAtRef = useRef<number | null>(null);
  const prevTargetIdRef = useRef(targetId);
  const isDirtyRef = useRef(isDirty);

  useEffect(() => {
    isDirtyRef.current = isDirty;
  }, [isDirty]);

  useEffect(() => {
    latestRef.current = { content, title, targetId };
    if (prevTargetIdRef.current !== targetId) {
      prevTargetIdRef.current = targetId;
      if (!isDirty) lastSavedRef.current = { content, title, targetId };
    }
  }, [content, title, targetId, isDirty]);

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
    ): Promise<SaveResult> => {
      if (!isMountedRef.current) return NOOP_RESULT;
      if (latestRef.current.targetId !== targetId) return NOOP_RESULT;
      if (!useEditorStore.getState().isDirty) return NOOP_RESULT;

      const snapshotContent = latestRef.current.content;
      const snapshotTitle = latestRef.current.title;

      const saved = lastSavedRef.current;
      const isUnchanged =
        saved.targetId === targetId &&
        saved.content === snapshotContent &&
        saved.title === snapshotTitle;
      if (isUnchanged) {
        if (isMountedRef.current && latestRef.current.targetId === targetId) {
          markSaved();
          failureCountRef.current = 0;
        }
        firstDirtyAtRef.current = null;
        clearRecovery(targetId);
        return { committed: true, wrote: false };
      }

      const seq = ++saveSeqRef.current;
      setSaving(true);
      try {
        await saveFn(snapshotContent, snapshotTitle);

        if (seq !== saveSeqRef.current) return { committed: true, wrote: true };

        if (isMountedRef.current && latestRef.current.targetId === targetId) {
          lastSavedRef.current = {
            content: snapshotContent,
            title: snapshotTitle,
            targetId,
          };
          const stillFresh =
            latestRef.current.content === snapshotContent &&
            latestRef.current.title === snapshotTitle;
          if (stillFresh) {
            markSaved();
            firstDirtyAtRef.current = null;
            clearRecovery(targetId);
          } else {
            setSaving(false);
          }
          failureCountRef.current = 0;
        }
        return { committed: true, wrote: true };
      } catch (err) {
        if (seq !== saveSeqRef.current) return NOOP_RESULT;
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
        return NOOP_RESULT;
      }
    },
    [targetId, setSaving, markSaved],
  );

  const save = useCallback(async () => {
    const result = await performSave(onSaveRef.current);
    if (result.wrote) flushPendingRef.current = true;
  }, [performSave]);

  const lastRecoveryWriteRef = useRef(0);
  const recoveryPromptedRef = useRef<string | null>(null);

  useEffect(() => {
    if (!enabled) return;
    const onPageHide = () => {
      const { content: c, title: t, targetId: id } = latestRef.current;
      if (useEditorStore.getState().isDirty) writeRecovery(id, c, t);
    };
    window.addEventListener("pagehide", onPageHide);
    return () => window.removeEventListener("pagehide", onPageHide);
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    if (recoveryPromptedRef.current === targetId) return;
    recoveryPromptedRef.current = targetId;

    const entry = readRecovery(targetId);
    if (!entry) return;
    if (entry.content === latestRef.current.content) {
      clearRecovery(targetId);
      return;
    }
    toast("Unsaved changes recovered", {
      id: `recovery-${targetId}`,
      description: `A newer local copy from ${new Date(
        entry.savedAt,
      ).toLocaleString()} never reached the server. Restore it?`,
      duration: 20_000,
      action: {
        label: "Restore",
        onClick: () => {
          const store = useEditorStore.getState();
          store.setContent(entry.content);
          if (entry.title) store.setTitle(entry.title);
          clearRecovery(targetId);
        },
      },
    });
  }, [enabled, targetId]);

  const flush = useCallback(async () => {
    const result = await performSave(onFlushRef.current ?? onSaveRef.current);
    if (result.wrote) flushPendingRef.current = false;
  }, [performSave]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: content & title are intentional re-trigger signals
  useEffect(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    if (!enabled) return;
    if (!isDirty) {
      firstDirtyAtRef.current = null;
      return;
    }
    if (firstDirtyAtRef.current === null) {
      firstDirtyAtRef.current = Date.now();
    }
    if (Date.now() - lastRecoveryWriteRef.current > RECOVERY_WRITE_MS) {
      lastRecoveryWriteRef.current = Date.now();
      writeRecovery(targetId, content, title);
    }
    const elapsedSinceFirstDirty = Date.now() - firstDirtyAtRef.current;
    const delay = Math.max(
      0,
      Math.min(DEBOUNCE_MS, MAX_WAIT_MS - elapsedSinceFirstDirty),
    );
    timerRef.current = setTimeout(() => {
      void save();
    }, delay);
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
      const { content: c, title: t, targetId: id } = latestRef.current;
      const flushFn = onFlushRef.current ?? onSaveRef.current;
      const saved = lastSavedRef.current;
      const hasUnsavedEdits =
        isDirtyRef.current &&
        !(saved.targetId === id && saved.content === c && saved.title === t);
      if (hasUnsavedEdits) {
        flushPendingRef.current = false;
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
