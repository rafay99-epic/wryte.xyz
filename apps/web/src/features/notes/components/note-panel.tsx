"use client";

import type { Id } from "@wryte/backend/_generated/dataModel";
import { Button } from "@wryte/ui/button";
import { X } from "lucide-react";
import { ExternalChangeBar } from "@/features/editor/components/external-change-bar";
import { NoteEditorSurface } from "@/features/editor/components/note-editor-surface";
import { useNoteEditor } from "../hooks/use-note-editor";
import { usePanelEscape } from "../hooks/use-panel-escape";
import { NoteHeader } from "./note-header";
import { NotePaneSkeleton } from "./note-pane-skeleton";

export function NotePanel({
  noteId,
  onClose,
}: {
  noteId: string;
  onClose: () => void;
}) {
  usePanelEscape(onClose);
  return (
    <NoteEditor key={noteId} noteId={noteId as Id<"notes">} onClose={onClose} />
  );
}

function NoteEditor({
  noteId,
  onClose,
}: {
  noteId: Id<"notes">;
  onClose: () => void;
}) {
  const editor = useNoteEditor(noteId);

  if (editor.missing) return <NoteMissing onClose={onClose} />;
  if (!editor.ready || !editor.meta) return <NotePaneSkeleton />;

  return (
    <div className="flex h-full min-h-0 flex-col">
      {editor.showExternalChange && (
        <ExternalChangeBar
          onReload={editor.reloadExternal}
          onDismiss={editor.dismissExternal}
        />
      )}
      <NoteHeader
        meta={editor.meta}
        flushNow={editor.flushNow}
        onClose={onClose}
      />
      <div className="min-h-0 flex-1 px-6 pb-6">
        <NoteEditorSurface target={editor.target} onBlur={editor.handleBlur} />
      </div>
    </div>
  );
}

function NoteMissing({ onClose }: { onClose: () => void }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 p-6">
      <p className="text-sm text-foreground">Note not found</p>
      <Button variant="outline" size="sm" onClick={onClose}>
        <X />
        Close
      </Button>
    </div>
  );
}
