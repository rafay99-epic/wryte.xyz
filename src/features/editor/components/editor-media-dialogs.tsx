"use client";

import { useEditorStore } from "@/stores/editor-store";
import { useEditorContext } from "./editor-context";
import { ImageInsertDialog } from "./image-insert-dialog";
import { VideoInsertDialog } from "./video-insert-dialog";

/**
 * Single mount point for the image/video insert dialogs, driven by the
 * editor store so any surface (toolbar Insert menu, slash commands) can
 * open them. Lives at the layout level — unlike the toolbar, it stays
 * mounted in focus mode.
 */
export function EditorMediaDialogs({
  documentId,
  projectId,
}: {
  documentId: string;
  projectId: string;
}) {
  const { insertAtCursor } = useEditorContext();
  const imageDialogOpen = useEditorStore((s) => s.imageDialogOpen);
  const setImageDialogOpen = useEditorStore((s) => s.setImageDialogOpen);
  const videoDialogOpen = useEditorStore((s) => s.videoDialogOpen);
  const setVideoDialogOpen = useEditorStore((s) => s.setVideoDialogOpen);

  return (
    <>
      <ImageInsertDialog
        open={imageDialogOpen}
        onOpenChange={setImageDialogOpen}
        onInsert={insertAtCursor}
        documentId={documentId}
        projectId={projectId}
      />
      <VideoInsertDialog
        open={videoDialogOpen}
        onOpenChange={setVideoDialogOpen}
        onInsert={insertAtCursor}
        documentId={documentId}
        projectId={projectId}
      />
    </>
  );
}
