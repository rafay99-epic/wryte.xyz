import { useEditorStore } from "@wryte/logic/stores/editor-store";
import { useCallback, useEffect, useRef } from "react";
import { toast } from "sonner";
import { useShallow } from "zustand/react/shallow";
import {
  clearRecovery,
  readRecovery,
  writeRecovery,
} from "../lib/recovery-buffer";

const DEBOUNCE_MS = 3000;
/** Min interval between recovery-buffer writes while typing. */
const RECOVERY_WRITE_MS = 2000;
// Ceiling on how long continuous typing can defer persistence. Without this,
// a trailing debounce that keeps getting reset by every keystroke never
// fires — the timer effect below shrinks its delay as this ceiling
// approaches so a save is forced once it's hit, even mid-flow.
const MAX_WAIT_MS = 30_000;
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

/** What's currently persisted server-side for a given save target. */
type SavedSnapshot = { targetId: string; content: string; title: string };

/** Outcome of a `performSave` attempt, used to drive the pending-flush flag. */
type SaveResult = {
  /** The store was left clean (dirty cleared) as a result of this call. */
  committed: boolean;
  /** An actual network write happened (as opposed to a dirty-check skip). */
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
  // True when the body has been autosaved (via onSave) since the last
  // metadata flush — so leaving the editor knows it still owes the
  // board/sidebar a metadata refresh even though nothing is "dirty".
  const flushPendingRef = useRef(false);
  // Monotonically increasing token per save attempt. After awaiting the
  // mutation we check that our token is still the latest; otherwise a newer
  // save kicked off mid-await and we drop the post-await side-effects to
  // avoid marking the editor as clean against stale content.
  const saveSeqRef = useRef(0);
  // Last content+title confirmed persisted for a given target. Lets
  // performSave skip the network call entirely when a tick's content is
  // byte-identical to what's already saved (e.g. typed then undone).
  // Seeded from the initial props: a freshly loaded document/draft is, by
  // definition, already in sync with the server.
  const lastSavedRef = useRef<SavedSnapshot>({ content, title, targetId });
  // Wall-clock time the current dirty streak started (cleared once the
  // store goes clean). Backs the max-wait ceiling below.
  const firstDirtyAtRef = useRef<number | null>(null);
  const prevTargetIdRef = useRef(targetId);

  useEffect(() => {
    latestRef.current = { content, title, targetId };
    // Switching targets (main doc <-> draft) always goes through
    // `initDocument` first, which loads the freshly-persisted snapshot for
    // the new target — so that value IS the last-saved baseline for it.
    if (prevTargetIdRef.current !== targetId) {
      prevTargetIdRef.current = targetId;
      lastSavedRef.current = { content, title, targetId };
    }
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
    ): Promise<SaveResult> => {
      if (!isMountedRef.current) return NOOP_RESULT;
      if (latestRef.current.targetId !== targetId) return NOOP_RESULT;
      if (!useEditorStore.getState().isDirty) return NOOP_RESULT;

      const snapshotContent = latestRef.current.content;
      const snapshotTitle = latestRef.current.title;

      // Dirty-check skip: the store thinks there's unsaved work, but the
      // current value is byte-identical to what's already persisted for
      // this target (e.g. the user typed then undid). Nothing to write.
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

        // A newer save started while we awaited — that call will handle the
        // result. Touching state here would mark the editor clean against
        // content the user has since moved past.
        if (seq !== saveSeqRef.current) return { committed: true, wrote: true };

        if (isMountedRef.current && latestRef.current.targetId === targetId) {
          // What we just sent is now the persisted state for this target,
          // regardless of whether newer edits have arrived meanwhile.
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
            // Everything the user typed is confirmed server-side — the
            // local recovery mirror has nothing left to protect.
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

  // Debounced periodic save — persists the body cheaply (no metadata churn).
  const save = useCallback(async () => {
    const result = await performSave(onSaveRef.current);
    if (result.wrote) flushPendingRef.current = true;
  }, [performSave]);

  // ── Local recovery buffer ─────────────────────────────────────────────
  // A save lost to a dying connection or closed tab takes the words with
  // it. Mirror the dirty buffer into localStorage (throttled while typing,
  // unconditionally on pagehide) and offer to restore it on the next visit.
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

  // Offer to restore a leftover buffer once per target. The buffer only
  // survives when a save never confirmed — a clean exit always clears it.
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

  // Terminal save (manual Cmd+S) — also refreshes derived metadata.
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
    // Mirror the dirty buffer locally so a killed tab/connection can't take
    // the words with it. Throttled — the sync JSON write is cheap but not
    // free on large documents.
    if (Date.now() - lastRecoveryWriteRef.current > RECOVERY_WRITE_MS) {
      lastRecoveryWriteRef.current = Date.now();
      writeRecovery(targetId, content, title);
    }
    // Shrink the delay as the max-wait ceiling approaches so continuous
    // typing (which keeps resetting this timer) can't defer persistence
    // indefinitely — the next reschedule fires almost immediately once
    // MAX_WAIT_MS has elapsed since the dirty streak started.
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
      const hasPendingTimer = timerRef.current !== null;
      const state = useEditorStore.getState();
      const { content: c, title: t } = latestRef.current;
      const flushFn = onFlushRef.current ?? onSaveRef.current;
      // Leaving with unsaved edits → full save. Otherwise, if the body was
      // autosaved but the documents row hasn't had its metadata refreshed
      // yet, flush it now so the board/sidebar reflect the final state.
      if (hasPendingTimer && state.isDirty) {
        const saved = lastSavedRef.current;
        const isUnchanged =
          saved.targetId === latestRef.current.targetId &&
          saved.content === c &&
          saved.title === t;
        // Same dirty-check as performSave: skip the full flush if the
        // pending edit reverted to the already-persisted value — but an
        // earlier body-only autosave may still owe the metadata refresh
        // (flushPendingRef), which must not be skipped along with it.
        if (!isUnchanged || flushPendingRef.current) {
          flushPendingRef.current = false;
          void flushFn(c, t).catch((err) => {
            console.error("[Autosave] Flush-on-unmount failed:", err);
          });
        }
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
