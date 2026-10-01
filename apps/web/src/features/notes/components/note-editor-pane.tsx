"use client";

import type { Id } from "@wryte/backend/_generated/dataModel";
import { NOTES_PATH } from "@wryte/logic/lib/notes/views";
import { buttonVariants } from "@wryte/ui/button";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { ExternalChangeBar } from "@/features/editor/components/external-change-bar";
import { NoteEditorSurface } from "@/features/editor/components/note-editor-surface";
import { useNoteEditor } from "../hooks/use-note-editor";
import { NoteHeader } from "./note-header";
import { NotePaneSkeleton } from "./note-pane-skeleton";

export function NoteEditorPane({ noteId }: { noteId: string }) {
  return <NoteEditor key={noteId} noteId={noteId as Id<"notes">} />;
}

function NoteEditor({ noteId }: { noteId: Id<"notes"> }) {
  const editor = useNoteEditor(noteId);

  if (editor.missing) return <NoteMissing />;
  if (!editor.ready || !editor.meta) return <NotePaneSkeleton noteOpen />;

  return (
    <div data-note-open className="flex h-full min-h-0 flex-col">
      {editor.showExternalChange && (
        <ExternalChangeBar
          onReload={editor.reloadExternal}
          onDismiss={editor.dismissExternal}
        />
      )}
      <NoteHeader meta={editor.meta} flushNow={editor.flushNow} />
      <div className="min-h-0 flex-1">
        <NoteEditorSurface target={editor.target} onBlur={editor.handleBlur} />
      </div>
    </div>
  );
}

function NoteMissing() {
  return (
    <div
      data-note-open
      className="flex h-full flex-col items-center justify-center gap-3 p-6"
    >
      <p className="text-sm text-foreground">Note not found</p>
      <Link
        href={NOTES_PATH}
        className={buttonVariants({ variant: "outline", size: "sm" })}
      >
        <ArrowLeft />
        Back to notes
      </Link>
    </div>
  );
}
