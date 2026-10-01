"use client";

import { todayKey } from "@wryte/logic/lib/notes/dates";
import {
  noteCountLabel,
  shareExpiryLabel,
} from "@wryte/logic/lib/notes/shares";
import { relativeTime } from "@wryte/logic/lib/relative-time";
import { useState } from "react";
import { SharedNoteSection } from "./components/shared-note-section";
import {
  SharedFooter,
  SharedHeader,
  SharedLoadError,
  SharedSkeleton,
  SharedUnavailable,
} from "./components/shared-states";
import { SharedToc } from "./components/shared-toc";
import { useNearViewport } from "./hooks/use-near-viewport";
import { useShareToken } from "./hooks/use-share-token";
import {
  type Bodies,
  type SharedView,
  useSharedNotes,
} from "./hooks/use-shared-notes";

export function SharedNotesPage() {
  const token = useShareToken();
  const [attempt, setAttempt] = useState(0);
  return (
    <div className="dark flex min-h-screen flex-col bg-black font-sans text-white">
      <SharedHeader />
      {token === undefined ? (
        <SharedSkeleton />
      ) : token === null ? (
        <SharedUnavailable />
      ) : (
        <SharedReader
          key={`${token}:${String(attempt)}`}
          token={token}
          onRetry={() => setAttempt((value) => value + 1)}
        />
      )}
      <SharedFooter />
    </div>
  );
}

function SharedReader({
  token,
  onRetry,
}: {
  token: string;
  onRetry: () => void;
}) {
  const { state, bodies, loadFrom } = useSharedNotes(token);
  switch (state.status) {
    case "loading":
      return <SharedSkeleton />;
    case "gone":
      return <SharedUnavailable />;
    case "error":
      return <SharedLoadError onRetry={onRetry} />;
    case "ready":
      return (
        <SharedDocument view={state.view} bodies={bodies} loadFrom={loadFrom} />
      );
  }
}

function SharedDocument({
  view,
  bodies,
  loadFrom,
}: {
  view: SharedView;
  bodies: Bodies;
  loadFrom: (index: number) => void;
}) {
  const observe = useNearViewport(loadFrom);
  const [today] = useState(todayKey);
  const [now] = useState(Date.now);
  const partial = view.notes.length < view.total;

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-6 pt-12 pb-16">
      <header className="mb-10">
        <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
          {view.title || "Untitled"}
        </h1>
        <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-white/55">
          {view.kind === "group" && view.group && view.group !== view.title && (
            <span>{view.group}</span>
          )}
          {view.kind !== "note" && (
            <span className="tabular-nums">
              {partial
                ? `Newest ${String(view.notes.length)} of ${noteCountLabel(view.total)}`
                : noteCountLabel(view.notes.length)}
            </span>
          )}
          <span>Updated {relativeTime(view.updatedAt)}</span>
          {view.expiresAt !== undefined && (
            <span>{shareExpiryLabel(view.expiresAt, now)}</span>
          )}
        </p>
      </header>
      {view.notes.length > 1 && <SharedToc notes={view.notes} />}
      {view.notes.length === 0 ? (
        <p className="text-sm text-white/50">No notes here yet.</p>
      ) : (
        <div className="divide-y divide-white/[0.08]">
          {view.notes.map((note, index) => (
            <SharedNoteSection
              key={note.noteId}
              note={note}
              index={index}
              body={bodies.get(note.noteId)}
              today={today}
              titleShown={note.title !== view.title}
              observe={observe}
              onRetry={loadFrom}
            />
          ))}
        </div>
      )}
    </main>
  );
}
