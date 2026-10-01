"use client";

import {
  NOTE_EDITOR_FEATURES,
  type NoteEditorTarget,
} from "@wryte/logic/lib/editor/features";
import { useEditorStore } from "@wryte/logic/stores/editor-store";
import { EditorProvider } from "./editor-context";
import { EditorMediaDialogs } from "./editor-media-dialogs";
import { EditorPanes } from "./editor-panes";
import { EditorToolbar } from "./editor-toolbar";

export function NoteEditorSurface({
  target,
  onBlur,
}: {
  target: NoteEditorTarget;
  onBlur?: () => void;
}) {
  const focusMode = useEditorStore((state) => state.focusMode);

  return (
    <EditorProvider>
      <EditorMediaDialogs target={target} />
      <div className="flex h-full flex-col">
        {!focusMode && (
          <EditorToolbar target={target} features={NOTE_EDITOR_FEATURES} />
        )}
        <EditorPanes
          target={target}
          features={NOTE_EDITOR_FEATURES}
          {...(onBlur ? { onBlur } : {})}
        />
      </div>
    </EditorProvider>
  );
}
