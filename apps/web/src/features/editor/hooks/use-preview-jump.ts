"use client";

import { resolveDoubleClickOffset } from "@wryte/logic/lib/editor/source-lines";
import { useEditorStore } from "@wryte/logic/stores/editor-store";
import { type MouseEvent, useCallback } from "react";

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
