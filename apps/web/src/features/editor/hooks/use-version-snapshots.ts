"use client";

import { api } from "@wryte/backend/_generated/api";
import type { Id } from "@wryte/backend/_generated/dataModel";
import { useEditorStore } from "@wryte/logic/stores/editor-store";
import { useMutation } from "convex/react";
import { useCallback, useEffect, useRef } from "react";

const INTERVAL_MS = 10 * 60 * 1000;

export function useVersionSnapshots({
  documentId,
  enabled,
}: {
  documentId: string;
  enabled: boolean;
}) {
  const createSnapshot = useMutation(api.cms.snapshots.create);
  const lastContentRef = useRef<string | null>(null);

  const snapshotNow = useCallback(
    (reason: "manual" | "interval") => {
      const { content, title, activeDraftId } = useEditorStore.getState();
      if (activeDraftId !== null) return;
      if (!content.trim()) return;
      if (lastContentRef.current === content) return;
      lastContentRef.current = content;
      void createSnapshot({
        documentId: documentId as Id<"documents">,
        title,
        content,
        reason,
      }).catch(() => {});
    },
    [createSnapshot, documentId],
  );

  useEffect(() => {
    if (!enabled) return;
    const id = setInterval(() => snapshotNow("interval"), INTERVAL_MS);
    return () => clearInterval(id);
  }, [enabled, snapshotNow]);

  return { snapshotNow };
}
