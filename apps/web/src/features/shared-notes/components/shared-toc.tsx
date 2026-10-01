import type { SharedNote } from "@wryte/backend/cms/notes/_lib/shareModel";
import { sharedNoteAnchor } from "@wryte/logic/lib/notes/shares";
import { cn } from "@wryte/logic/lib/utils";
import { StatusIcon } from "@/features/notes/components/status-icon";

function jumpTo(noteId: string) {
  const anchor = sharedNoteAnchor(noteId);
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  document
    .getElementById(anchor)
    ?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
  document.getElementById(`${anchor}-title`)?.focus({ preventScroll: true });
}

export function SharedToc({ notes }: { notes: readonly SharedNote[] }) {
  return (
    <nav
      aria-label="Contents"
      className="mb-6 border-b border-white/[0.08] pb-6"
    >
      <ol className="grid gap-x-4 sm:grid-cols-2">
        {notes.map((note) => (
          <li key={note.noteId} className="min-w-0">
            <button
              type="button"
              onClick={() => jumpTo(note.noteId)}
              className={cn(
                "-mx-2 flex w-[calc(100%+1rem)] min-w-0 items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] outline-none hover:bg-white/[0.05] focus-visible:ring-2 focus-visible:ring-white/30",
                note.title ? "text-white/75 hover:text-white" : "text-white/45",
              )}
            >
              <StatusIcon status={note.status ?? "notes"} className="size-3" />
              <span className="truncate">{note.title || "Untitled"}</span>
            </button>
          </li>
        ))}
      </ol>
    </nav>
  );
}
