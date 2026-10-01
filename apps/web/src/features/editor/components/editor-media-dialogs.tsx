"use client";

import type { EditorTarget } from "@wryte/logic/lib/editor/target";
import { useEditorStore } from "@wryte/logic/stores/editor-store";
import { AnimationInsertDialog } from "./animation-insert-dialog";
import { useEditorContext } from "./editor-context";
import { EmbedInsertDialog } from "./embed-insert-dialog";
import { ImageInsertDialog } from "./image-insert-dialog";
import { VideoInsertDialog } from "./video-insert-dialog";

export function EditorMediaDialogs({ target }: { target: EditorTarget }) {
  const { insertAtCursor } = useEditorContext();
  const imageDialogOpen = useEditorStore((s) => s.imageDialogOpen);
  const setImageDialogOpen = useEditorStore((s) => s.setImageDialogOpen);
  const videoDialogOpen = useEditorStore((s) => s.videoDialogOpen);
  const setVideoDialogOpen = useEditorStore((s) => s.setVideoDialogOpen);
  const embedDialogOpen = useEditorStore((s) => s.embedDialogOpen);
  const setEmbedDialogOpen = useEditorStore((s) => s.setEmbedDialogOpen);
  const animationDialogOpen = useEditorStore((s) => s.animationDialogOpen);
  const setAnimationDialogOpen = useEditorStore(
    (s) => s.setAnimationDialogOpen,
  );

  return (
    <>
      <ImageInsertDialog
        open={imageDialogOpen}
        onOpenChange={setImageDialogOpen}
        onInsert={insertAtCursor}
        target={target}
      />
      {target.kind === "document" && (
        <>
          <VideoInsertDialog
            open={videoDialogOpen}
            onOpenChange={setVideoDialogOpen}
            onInsert={insertAtCursor}
            documentId={target.documentId}
            projectId={target.projectId}
          />
          <AnimationInsertDialog
            open={animationDialogOpen}
            onOpenChange={setAnimationDialogOpen}
            onInsert={insertAtCursor}
            projectId={target.projectId}
          />
        </>
      )}
      <EmbedInsertDialog
        open={embedDialogOpen}
        onOpenChange={setEmbedDialogOpen}
        onInsert={insertAtCursor}
      />
    </>
  );
}
