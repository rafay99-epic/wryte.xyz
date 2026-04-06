import { useCallback, useEffect, useRef } from "react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { useEditorStore } from "@/stores/editor-store";
import { useShallow } from "zustand/react/shallow";

/**
 * How long (ms) to wait after the last keystroke before triggering a save.
 * Balances responsiveness (user sees "saved" quickly) against not flooding
 * the backend with mutations on every character typed.
 */
const DEBOUNCE_MS = 2000;

/** Options required to wire up autosave for a specific document. */
interface AutosaveOptions {
  documentId: string;
  content: string;
  title: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- api types are generated at build time via `npx convex dev`
const updateMutation = (api as any).documents.update;

/**
 * Debounced autosave hook for the markdown editor.
 *
 * Listens for changes to `content` or `title`, waits {@link DEBOUNCE_MS} after
 * the last change, then persists the latest values to Convex. The debounce
 * timer resets on every change so rapid typing only produces a single save.
 *
 * Save status (isSaving / lastSavedAt) is managed through the global editor store
 * so the toolbar can display a save indicator without prop drilling.
 *
 * @returns `isSaving` — true while a network request is in-flight
 * @returns `lastSavedAt` — Unix-ms timestamp of the last successful save
 */
export function useAutosave({ documentId, content, title }: AutosaveOptions) {
  const updateDocument = useMutation(updateMutation);
  // Pull only the save-related slice to avoid re-renders from unrelated store changes
  const { isSaving, lastSavedAt, setSaving, markSaved } = useEditorStore(
    useShallow((state) => ({
      isSaving: state.isSaving,
      lastSavedAt: state.lastSavedAt,
      setSaving: state.setSaving,
      markSaved: state.markSaved,
    })),
  );

  // Holds the pending setTimeout id so we can cancel it on the next change
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Always point at the freshest content/title so the save callback
  // never captures a stale closure over old values
  const latestRef = useRef({ content, title });

  useEffect(() => {
    latestRef.current = { content, title };
  }, [content, title]);

  /** Persist the latest content & title to the backend. */
  const save = useCallback(async () => {
    const { content: currentContent, title: currentTitle } = latestRef.current;
    setSaving(true);
    try {
      await updateDocument({
        documentId: documentId as Id<"documents">,
        content: currentContent,
        title: currentTitle,
      });
      // Only clear dirty flag on success — a failed save should leave dirty = true
      markSaved();
    } catch {
      // Reset saving indicator but keep isDirty so the next debounce retries
      setSaving(false);
    }
  }, [documentId, updateDocument, setSaving, markSaved]);

  // Debounce effect: every time content or title changes, restart the timer.
  // When the timer finally fires (no new changes for DEBOUNCE_MS), trigger save.
  useEffect(() => {
    // Cancel any previously scheduled save
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    // Schedule a new save after the debounce window
    timerRef.current = setTimeout(() => {
      void save();
    }, DEBOUNCE_MS);

    // Cleanup on unmount or before next effect run to prevent double-saves
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [content, title, save]);

  return { isSaving, lastSavedAt };
}
