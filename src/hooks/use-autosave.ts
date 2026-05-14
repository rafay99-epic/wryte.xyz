import { useMutation } from "convex/react";
import { useCallback, useEffect, useRef } from "react";
import { toast } from "sonner";
import { useShallow } from "zustand/react/shallow";
import { useEditorStore } from "@/stores/editor-store";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";

/**
 * How long (ms) to wait after the last keystroke before triggering a save.
 * Balances responsiveness (user sees "saved" quickly) against not flooding
 * the backend with mutations on every character typed. 3 seconds is the
 * sweet spot — long enough to coalesce a burst of typing into a single
 * save, short enough that the "saved" indicator still feels live.
 */
const DEBOUNCE_MS = 3000;

/** After this many consecutive failures, show a warning toast. */
const FAILURE_THRESHOLD = 3;

/** Options required to wire up autosave for a specific document. */
type AutosaveOptions = {
  documentId: string;
  content: string;
  title: string;
  /**
   * When false, suppresses the debounced auto-save and the flush-on-unmount
   * safety net. The returned `saveNow` still works so the author can persist
   * changes manually (e.g. via Cmd/Ctrl+S). Defaults to `true`.
   */
  enabled?: boolean;
};

type AutosaveReturn = {
  isSaving: boolean;
  lastSavedAt: number | null;
  /**
   * Persist the latest content/title immediately, cancelling any pending
   * debounce. Safe to call repeatedly — no-ops if there's nothing dirty.
   * Resolves once the save round-trip completes (success or failure).
   */
  saveNow: () => Promise<void>;
};

const updateMutation = api.cms.documents.update;

/**
 * Debounced autosave hook for the markdown editor.
 *
 * Listens for changes to `content` or `title`, waits {@link DEBOUNCE_MS} after
 * the last change, then persists the latest values to Convex. The debounce
 * timer resets on every change so rapid typing only produces a single save.
 *
 * Safety features:
 *  - Validates the document ID hasn't changed before saving (prevents cross-doc corruption)
 *  - Guards against saves on unmounted components
 *  - Tracks consecutive failures and warns the user after {@link FAILURE_THRESHOLD}
 *  - Skips saves when content hasn't actually changed (isDirty is false)
 *
 * Save status (isSaving / lastSavedAt) is managed through the global editor store
 * so the toolbar can display a save indicator without prop drilling.
 */
export function useAutosave({
  documentId,
  content,
  title,
  enabled = true,
}: AutosaveOptions): AutosaveReturn {
  const updateDocument = useMutation(updateMutation);
  // Pull only the save-related slice to avoid re-renders from unrelated store changes
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

  // Holds the pending setTimeout id so we can cancel it on the next change
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Always point at the freshest content/title so the save callback
  // never captures a stale closure over old values
  const latestRef = useRef({ content, title, documentId });

  // Guard: prevent saving after unmount
  const isMountedRef = useRef(true);

  // Track consecutive save failures for user feedback
  const failureCountRef = useRef(0);

  useEffect(() => {
    latestRef.current = { content, title, documentId };
  }, [content, title, documentId]);

  // Mount/unmount lifecycle
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  /** Persist the latest content & title to the backend. */
  const save = useCallback(async () => {
    // Guard: abort if component unmounted between debounce and execution
    if (!isMountedRef.current) return;

    // Guard: abort if the documentId changed (user navigated to another doc)
    if (latestRef.current.documentId !== documentId) return;

    // Guard: skip if the store reports nothing has changed
    if (!useEditorStore.getState().isDirty) return;

    // Snapshot the values we're about to persist so that we can detect typing
    // that happens DURING the in-flight save. Without this, `markSaved()`
    // would clear the dirty flag even though the local content has moved on,
    // and the editor page's "sync external changes" effect would then
    // overwrite the user's in-progress typing with the server snapshot.
    const snapshotContent = latestRef.current.content;
    const snapshotTitle = latestRef.current.title;
    setSaving(true);
    try {
      await updateDocument({
        documentId: documentId as Id<"documents">,
        content: snapshotContent,
        title: snapshotTitle,
      });

      // Only update state if still mounted and on the same document
      if (isMountedRef.current && latestRef.current.documentId === documentId) {
        const stillFresh =
          latestRef.current.content === snapshotContent &&
          latestRef.current.title === snapshotTitle;
        if (stillFresh) {
          // No typing happened during the save — safe to mark clean.
          markSaved();
        } else {
          // The user typed while we were saving. Keep `isDirty` true so the
          // sync effect on the editor page doesn't snap us back to the
          // server snapshot, and let the debounce schedule the next save.
          setSaving(false);
        }
        failureCountRef.current = 0; // reset on success
      }
    } catch (err) {
      if (isMountedRef.current) {
        setSaving(false);
        failureCountRef.current += 1;

        console.error("[Autosave] Failed to save:", err);

        // Warn user after repeated failures
        if (failureCountRef.current === FAILURE_THRESHOLD) {
          toast.error("Unable to save — check your connection", {
            id: "autosave-failure", // dedup: only one toast at a time
            duration: 5000,
          });
        }
      }
    }
  }, [documentId, updateDocument, setSaving, markSaved]);

  // Debounce effect: every time content or title changes, restart the timer.
  // When the timer finally fires (no new changes for DEBOUNCE_MS), trigger save.
  //
  // The deps deliberately include `content` and `title` (not just `isDirty`)
  // so that EVERY keystroke resets the timer — otherwise the timer fires
  // N seconds after the first dirty change regardless of subsequent typing,
  // which opens a wide race window where the save runs with stale content
  // while the user is still typing.
  // biome-ignore lint/correctness/useExhaustiveDependencies: content & title are intentional re-trigger signals, not values read inside the effect (the save callback reads latestRef.current at execution time)
  useEffect(() => {
    // Cancel any previously scheduled save
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    // If auto-save is off, never schedule — the author is driving saves
    // manually via the Cmd/Ctrl+S shortcut.
    if (!enabled) return;

    // Only schedule if there's actually something to save
    if (!isDirty) return;

    // Schedule a new save after the debounce window
    timerRef.current = setTimeout(() => {
      void save();
    }, DEBOUNCE_MS);

    // Cleanup on unmount or before next effect run to prevent double-saves
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [content, title, isDirty, save, enabled]);

  // Flush-on-unmount: if there's a pending save when the component goes away
  // (user navigates away mid-debounce), fire the mutation as fire-and-forget.
  // Convex completes the mutation server-side regardless of the React tree.
  //
  // This effect is registered last so its cleanup runs first on unmount —
  // before the debounce cleanup nukes `timerRef` and before the editor page's
  // cleanup wipes the store via `reset()`.
  useEffect(() => {
    return () => {
      // Auto-save is the contract that "your work is safe even if you forget
      // to save." When the author disables it, they own the responsibility
      // for unsaved work, and a surprise flush on navigation would violate
      // that expectation.
      if (!enabled) return;
      const hasPendingTimer = timerRef.current !== null;
      const state = useEditorStore.getState();
      if (!hasPendingTimer || !state.isDirty) return;
      const { documentId: id, content: c, title: t } = latestRef.current;
      // Read from latestRef (not the store) — `latestRef` mirrors the values
      // we'd have saved on the next debounce tick, which is the user's
      // intent. Fire-and-forget; nothing here awaits the result.
      void updateDocument({
        documentId: id as Id<"documents">,
        content: c,
        title: t,
      }).catch((err) => {
        console.error("[Autosave] Flush-on-unmount failed:", err);
      });
    };
  }, [updateDocument, enabled]);

  /**
   * Manual save trigger. Cancels any pending debounce and runs the save
   * immediately. Useful for the Cmd/Ctrl+S shortcut and works regardless
   * of whether auto-save is enabled.
   */
  const saveNow = useCallback(async () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    await save();
  }, [save]);

  return { isSaving, lastSavedAt, saveNow };
}
