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
interface AutosaveOptions {
  documentId: string;
  content: string;
  title: string;
}

const updateMutation = api.documents.update;

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
export function useAutosave({ documentId, content, title }: AutosaveOptions) {
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

    const { content: currentContent, title: currentTitle } = latestRef.current;
    setSaving(true);
    try {
      await updateDocument({
        documentId: documentId as Id<"documents">,
        content: currentContent,
        title: currentTitle,
      });

      // Only update state if still mounted and on the same document
      if (isMountedRef.current && latestRef.current.documentId === documentId) {
        markSaved();
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
  useEffect(() => {
    // Cancel any previously scheduled save
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

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
  }, [isDirty, save]);

  return { isSaving, lastSavedAt };
}
