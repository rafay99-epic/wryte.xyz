import type { SharedNote } from "@wryte/backend/cms/notes/_lib/shareModel";
import { DUE_TONES } from "@wryte/logic/lib/notes/colors";
import { dueLabel, dueTone } from "@wryte/logic/lib/notes/dates";
import { REF_KIND_LABELS, REF_KINDS } from "@wryte/logic/lib/notes/refs";
import { sharedNoteAnchor } from "@wryte/logic/lib/notes/shares";
import { NOTE_STATUS_LABELS } from "@wryte/logic/lib/notes/status";
import { relativeTime } from "@wryte/logic/lib/relative-time";
import { cn } from "@wryte/logic/lib/utils";
import { CalendarClock } from "lucide-react";
import { memo } from "react";
import { ChangelogMarkdown } from "@/components/changelog/changelog-markdown";
import { RefKindIcon } from "@/features/notes/components/ref-kind-icon";
import { StatusIcon } from "@/features/notes/components/status-icon";
import type { BodyState } from "../hooks/use-shared-notes";
import { SharedComments, SharedRefLinks } from "./shared-refs";
import { BodyPlaceholder } from "./shared-states";

const PROSE_CLASS =
  "prose prose-invert max-w-none prose-headings:font-semibold prose-headings:tracking-tight prose-h1:text-xl prose-h2:text-lg prose-h3:text-base prose-p:leading-[1.8] prose-p:text-white/85 prose-li:leading-[1.8] prose-li:text-white/85 prose-pre:bg-transparent prose-pre:p-0 prose-pre:border-0 prose-strong:text-white prose-img:rounded-xl";

export const SharedNoteSection = memo(function SharedNoteSection({
  note,
  index,
  body,
  today,
  titleShown,
  observe,
  onRetry,
}: {
  note: SharedNote;
  index: number;
  body: BodyState | undefined;
  today: string;
  titleShown: boolean;
  observe: (index: number, element: Element) => () => void;
  onRetry: (index: number) => void;
}) {
  const anchor = sharedNoteAnchor(note.noteId);
  return (
    <article
      id={anchor}
      aria-labelledby={`${anchor}-title`}
      ref={
        body === undefined
          ? (element) => (element ? observe(index, element) : undefined)
          : undefined
      }
      className="scroll-mt-16 py-10 first:pt-0"
    >
      <NoteMeta note={note} today={today} />
      <h2
        id={`${anchor}-title`}
        tabIndex={-1}
        className={cn(
          "mt-2 text-xl font-semibold tracking-tight outline-none",
          note.title ? "text-white" : "text-white/50 italic",
          !titleShown && "sr-only",
        )}
      >
        {note.title || "Untitled"}
      </h2>
      <NoteBody body={body} onRetry={() => onRetry(index)} />
    </article>
  );
});

function NoteBody({
  body,
  onRetry,
}: {
  body: BodyState | undefined;
  onRetry: () => void;
}) {
  if (body === undefined) return <BodyPlaceholder className="mt-6" />;
  if (body.status === "missing") {
    return (
      <p className="mt-4 text-sm text-white/50">
        This note is no longer shared.
      </p>
    );
  }
  if (body.status === "error") {
    return (
      <p className="mt-4 flex items-center gap-3 text-sm text-white/55">
        Couldn't load this note.
        <button
          type="button"
          onClick={onRetry}
          className="rounded text-white underline underline-offset-4 outline-none focus-visible:ring-2 focus-visible:ring-white/30"
        >
          Retry
        </button>
      </p>
    );
  }
  const { content, refs } = body.body;
  return (
    <>
      <SharedRefLinks refs={refs} />
      {content.trim() ? (
        <div className={cn(PROSE_CLASS, "mt-6")}>
          <ChangelogMarkdown content={content} />
        </div>
      ) : (
        <p className="mt-4 text-sm text-white/40 italic">Empty note</p>
      )}
      <SharedComments refs={refs} />
    </>
  );
}

function NoteMeta({ note, today }: { note: SharedNote; today: string }) {
  const counts = note.refCounts;
  const kinds = counts ? REF_KINDS.filter((kind) => counts[kind] > 0) : [];
  const tone = note.dueDate ? dueTone(note, today) : null;
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-white/50">
      {note.status && (
        <span className="flex items-center gap-1.5 text-white/70">
          <StatusIcon status={note.status} className="size-3" />
          {NOTE_STATUS_LABELS[note.status]}
        </span>
      )}
      {note.group && <span className="max-w-48 truncate">{note.group}</span>}
      {note.dueDate && tone && (
        <span
          className={cn(
            "flex items-center gap-1 tabular-nums",
            DUE_TONES[tone],
          )}
        >
          <CalendarClock aria-hidden className="size-3" />
          {tone === "overdue"
            ? `Overdue, ${dueLabel(note.dueDate, today)}`
            : tone === "today"
              ? "Due today"
              : `Due ${dueLabel(note.dueDate, today)}`}
        </span>
      )}
      {kinds.map((kind) => (
        <span
          key={kind}
          className="flex items-center gap-1 tabular-nums"
          title={REF_KIND_LABELS[kind]}
        >
          <RefKindIcon kind={kind} className="size-3" />
          {counts?.[kind]}
          <span className="sr-only">{REF_KIND_LABELS[kind]}</span>
        </span>
      ))}
      <span>Updated {relativeTime(note.updatedAt)}</span>
    </div>
  );
}
