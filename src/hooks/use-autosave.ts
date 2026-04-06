import { useCallback, useEffect, useRef } from "react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { useEditorStore } from "@/stores/editor-store";
import { useShallow } from "zustand/react/shallow";

const DEBOUNCE_MS = 2000;

interface AutosaveOptions {
  documentId: string;
  content: string;
  title: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- api types are generated at build time via `npx convex dev`
const updateMutation = (api as any).documents.update;

export function useAutosave({ documentId, content, title }: AutosaveOptions) {
  const updateDocument = useMutation(updateMutation);
  const { isSaving, lastSavedAt, setSaving, markSaved } = useEditorStore(
    useShallow((state) => ({
      isSaving: state.isSaving,
      lastSavedAt: state.lastSavedAt,
      setSaving: state.setSaving,
      markSaved: state.markSaved,
    })),
  );

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestRef = useRef({ content, title });

  useEffect(() => {
    latestRef.current = { content, title };
  }, [content, title]);

  const save = useCallback(async () => {
    const { content: currentContent, title: currentTitle } = latestRef.current;
    setSaving(true);
    try {
      await updateDocument({
        documentId: documentId as Id<"documents">,
        content: currentContent,
        title: currentTitle,
      });
      markSaved();
    } catch {
      setSaving(false);
    }
  }, [documentId, updateDocument, setSaving, markSaved]);

  useEffect(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    timerRef.current = setTimeout(() => {
      void save();
    }, DEBOUNCE_MS);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [content, title, save]);

  return { isSaving, lastSavedAt };
}
