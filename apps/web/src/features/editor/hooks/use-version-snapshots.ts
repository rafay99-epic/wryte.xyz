"use client";

import { api } from "@wryte/backend/_generated/api";
import type { Id } from "@wryte/backend/_generated/dataModel";
import { useEditorStore } from "@wryte/logic/stores/editor-store";
import { useMutation } from "convex/react";
import { useCallback, useEffect, useRef } from "react";

/** Coarse cadence for automatic snapshots during active editing. */
const INTERVAL_MS = 10 * 60 * 1000;

/**
 * Version-snapshot triggers. Snapshots are cheap but not free, so they
 * fire only at meaningful points:
 *  - `snapshotNow("manual")` after an explicit Cmd+S save
 *  - every 10 minutes while the content keeps changing
 *
 * Only the MAIN document stream is snapshotted (parallel drafts are
 * themselves checkpoints). The server additionally dedupes identical
 * content, so redundant calls cost one no-op mutation at most — and the
 * client-side content guard avoids even that in the common case.
 */
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
      // Fire-and-forget — a failed snapshot must never block editing.
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
