import { Suspense, use } from "react";
import { NoteEditorPane } from "@/features/notes/components/note-editor-pane";
import { NotePaneSkeleton } from "@/features/notes/components/note-pane-skeleton";

export default function Page({
  params,
}: {
  params: Promise<{ noteId: string }>;
}) {
  return (
    <Suspense fallback={<NotePaneSkeleton />}>
      <NoteRoute params={params} />
    </Suspense>
  );
}

function NoteRoute({ params }: { params: Promise<{ noteId: string }> }) {
  const { noteId } = use(params);
  return <NoteEditorPane noteId={noteId} />;
}
