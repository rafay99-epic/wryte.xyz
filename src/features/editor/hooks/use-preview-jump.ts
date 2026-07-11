"use client";

import { type MouseEvent, useCallback } from "react";
import { useEditorStore } from "@/stores/editor-store";
import { resolveDoubleClickOffset } from "../lib/source-lines";

/**
 * Double-click-to-edit for the preview panes (markdown and MDX).
 *
 * Resolves the clicked element to a source offset, queues it as the pending
 * caret (consumed by the markdown editor once its textarea exists), and — in
 * full preview mode — switches to edit mode so the editor mounts and jumps.
 * In split mode the editor is already on screen; only the caret moves.
 *
 * `renderedContent` is the source the preview was rendered from. The preview
 * lags the store (deferred render / MDX debounce), so stamped line numbers
 * must be resolved against it — resolving against the live store content
 * would map lines through a document the user isn't looking at. Omit it to
 * fall back to the store content (MDX, whose word search doesn't use lines).
 */
export function usePreviewJump(renderedContent?: string) {
  return useCallback(
    (e: MouseEvent<HTMLElement>) => {
      const state = useEditorStore.getState();
      const offset = resolveDoubleClickOffset(
        e.target as HTMLElement,
        renderedContent ?? state.content,
      );
      if (offset === null) return;
      state.setPendingCaret(offset);
      if (state.viewMode === "preview") state.setViewMode("edit");
    },
    [renderedContent],
  );
}
