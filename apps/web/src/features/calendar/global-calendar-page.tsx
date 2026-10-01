"use client";

import { api } from "@wryte/backend/_generated/api";
import { useAuthedQuery } from "@wryte/logic/hooks/use-authed-query";
import {
  DAYS,
  getDateKey,
  getDaysInMonth,
  getFirstDayOfMonth,
  groupNoteEventsByDay,
  isSameDay,
  MONTHS,
  monthRange,
  NOTE_EVENT_LABELS,
  type NoteEventKind,
} from "@wryte/logic/lib/calendar-utils";
import { dueLabel } from "@wryte/logic/lib/notes/dates";
import { notePath } from "@wryte/logic/lib/notes/views";
import { cn } from "@wryte/logic/lib/utils";
import { Button } from "@wryte/ui/button";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { NoteEventMark } from "./components/note-event-mark";

const PROJECT_COLORS = [
  "bg-emerald-400",
  "bg-sky-400",
  "bg-violet-400",
  "bg-rose-400",
  "bg-teal-400",
  "bg-orange-400",
];

type CalendarEvent = {
  docId: string;
  projectId: string;
  projectName: string;
  title: string;
  kind: "published" | "scheduled";
  at: number;
};

const NOTE_KINDS: readonly NoteEventKind[] = [
  "overdue",
  "due",
  "opened",
  "done",
];
const MAX_CELL_NOTES = 2;
const MAX_CELL_DOTS = 4;

export function GlobalCalendarPage() {
  const router = useRouter();
  const docs = useAuthedQuery(api.cms.documents.listForCalendarAllProjects, {});

  const now = new Date();
  const todayKey = getDateKey(now);
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  const range = useMemo(
    () => monthRange(year, month, todayKey),
    [year, month, todayKey],
  );
  const noteEvents = useAuthedQuery(api.cms.notes.calendar.month, range);
  const notesByDay = useMemo(
    () => groupNoteEventsByDay(noteEvents ?? [], range.today),
    [noteEvents, range.today],
  );

  const { eventsByDay, projectColor, projects } = useMemo(() => {
    const byDay = new Map<string, CalendarEvent[]>();
    const colorByProject = new Map<string, string>();
    const projectList: Array<{ id: string; name: string; color: string }> = [];

    for (const doc of docs ?? []) {
      if (!colorByProject.has(doc.projectId)) {
        const color =
          PROJECT_COLORS[projectList.length % PROJECT_COLORS.length] ??
          "bg-emerald-400";
        colorByProject.set(doc.projectId, color);
        projectList.push({ id: doc.projectId, name: doc.projectName, color });
      }
      const push = (kind: CalendarEvent["kind"], at: number) => {
        const key = getDateKey(new Date(at));
        const list = byDay.get(key) ?? [];
        list.push({
          docId: doc._id,
          projectId: doc.projectId,
          projectName: doc.projectName,
          title: doc.title,
          kind,
          at,
        });
        byDay.set(key, list);
      };
      if (doc.publishedAt !== undefined) push("published", doc.publishedAt);
      if (doc.scheduledAt !== undefined) push("scheduled", doc.scheduledAt);
    }
    for (const list of byDay.values()) {
      list.sort((a, b) => a.at - b.at);
    }
    return {
      eventsByDay: byDay,
      projectColor: colorByProject,
      projects: projectList,
    };
  }, [docs]);

  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);
  const today = new Date();

  const goToMonth = (delta: number) => {
    const next = new Date(year, month + delta, 1);
    setYear(next.getFullYear());
    setMonth(next.getMonth());
    setSelectedKey(null);
  };

  const selectedEvents = selectedKey
    ? (eventsByDay.get(selectedKey) ?? [])
    : [];
  const selectedNotes = selectedKey ? (notesByDay.get(selectedKey) ?? []) : [];
  const hasNotes = notesByDay.size > 0;

  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight">
            <CalendarDays className="size-5 text-amber-500" />
            Calendar
          </h1>
          <p className="text-sm text-muted-foreground">
            Every project, one cadence.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => goToMonth(-1)}>
            <ChevronLeft className="size-4" />
          </Button>
          <span className="min-w-36 text-center text-sm font-medium">
            {MONTHS[month]} {year}
          </span>
          <Button variant="ghost" size="icon" onClick={() => goToMonth(1)}>
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>

      {(projects.length > 0 || hasNotes) && (
        <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
          {projects.slice(0, 5).map((p) => (
            <span key={p.id} className="flex items-center gap-1.5">
              <span className={cn("size-2 rounded-full", p.color)} />
              {p.name}
            </span>
          ))}
          {projects.length > 5 && <span>+{projects.length - 5} more</span>}
          <span className="ml-auto flex flex-wrap items-center gap-3">
            <span className="flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-muted-foreground" />
              published
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-2 rounded-full border border-muted-foreground" />
              scheduled
            </span>
            {hasNotes &&
              NOTE_KINDS.map((kind) => (
                <span key={kind} className="flex items-center gap-1.5">
                  <NoteEventMark kind={kind} />
                  {NOTE_EVENT_LABELS[kind].toLowerCase()}
                </span>
              ))}
          </span>
        </div>
      )}

      <div className="grid grid-cols-7 gap-1">
        {DAYS.map((d) => (
          <div
            key={d}
            className="pb-1 text-center font-mono text-[10px] uppercase tracking-wide text-muted-foreground"
          >
            {d}
          </div>
        ))}
        {Array.from({ length: firstDay }, (_, i) => (
          <div key={`pad-${String(i)}`} />
        ))}
        {Array.from({ length: daysInMonth }, (_, i) => {
          const day = i + 1;
          const date = new Date(year, month, day);
          const key = getDateKey(date);
          const events = eventsByDay.get(key) ?? [];
          const notes = notesByDay.get(key) ?? [];
          const isToday = isSameDay(date, today);
          const isSelected = selectedKey === key;
          const hiddenCount =
            Math.max(0, events.length - MAX_CELL_DOTS) +
            Math.max(0, notes.length - MAX_CELL_NOTES);
          const summary = [
            events.length > 0 ? `${String(events.length)} articles` : null,
            notes.length > 0 ? `${String(notes.length)} tasks` : null,
          ]
            .filter(Boolean)
            .join(", ");
          return (
            <button
              key={key}
              type="button"
              aria-pressed={isSelected}
              aria-label={`${MONTHS[month] ?? ""} ${String(day)}${summary ? `, ${summary}` : ""}`}
              onClick={() => setSelectedKey(isSelected ? null : key)}
              className={cn(
                "flex min-h-16 flex-col rounded-lg border border-border/40 bg-card p-1.5 text-left transition-colors hover:border-border",
                isToday && "border-amber-500/60",
                isSelected && "bg-muted/60",
              )}
            >
              <span
                className={cn(
                  "text-[11px]",
                  isToday
                    ? "font-semibold text-amber-500"
                    : "text-muted-foreground",
                )}
              >
                {day}
              </span>
              {notes.length > 0 && (
                <span className="mt-1 flex min-w-0 flex-col gap-0.5">
                  {notes.slice(0, MAX_CELL_NOTES).map((n) => (
                    <span
                      key={`${n.noteId}-${n.kind}`}
                      className="flex min-w-0 items-center gap-1 text-[10px] leading-tight"
                    >
                      <NoteEventMark kind={n.kind} className="size-2.5" />
                      <span className="truncate">{n.title || "Untitled"}</span>
                    </span>
                  ))}
                </span>
              )}
              {(events.length > 0 || hiddenCount > 0) && (
                <span className="mt-auto flex flex-wrap gap-1 pt-1">
                  {events.slice(0, MAX_CELL_DOTS).map((e) => (
                    <span
                      key={`${e.docId}-${e.kind}`}
                      className={cn(
                        "size-1.5 rounded-full",
                        e.kind === "published"
                          ? projectColor.get(e.projectId)
                          : cn(
                              "border bg-transparent",
                              (
                                projectColor.get(e.projectId) ??
                                "bg-emerald-400"
                              ).replace("bg-", "border-"),
                            ),
                      )}
                    />
                  ))}
                  {hiddenCount > 0 && (
                    <span className="text-[9px] leading-none text-muted-foreground">
                      +{hiddenCount}
                    </span>
                  )}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {selectedKey && (
        <div className="mt-4 rounded-xl border border-border/40 bg-card p-4">
          {selectedEvents.length === 0 && selectedNotes.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nothing on this day.
            </p>
          ) : (
            <ul className="space-y-1.5">
              {selectedNotes.map((n) => (
                <li key={`${n.noteId}-${n.kind}`}>
                  <Link
                    href={notePath(n.noteId)}
                    className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-sm transition-colors hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:outline-none"
                  >
                    <NoteEventMark kind={n.kind} className="size-3.5" />
                    <span className="min-w-0 flex-1 truncate">
                      {n.title || "Untitled"}
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {n.kind === "overdue" && n.dueDate
                        ? `${NOTE_EVENT_LABELS.overdue} · ${dueLabel(n.dueDate, range.today)}`
                        : NOTE_EVENT_LABELS[n.kind]}
                    </span>
                  </Link>
                </li>
              ))}
              {selectedEvents.map((e) => (
                <li key={`${e.docId}-${e.kind}`}>
                  <button
                    type="button"
                    onClick={() => router.push(`/editor/${e.docId}`)}
                    className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-sm transition-colors hover:bg-muted/60"
                  >
                    <span
                      className={cn(
                        "size-2 shrink-0 rounded-full",
                        projectColor.get(e.projectId),
                      )}
                    />
                    <span className="min-w-0 flex-1 truncate">
                      {e.title || "Untitled"}
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {e.projectName} ·{" "}
                      {e.kind === "scheduled"
                        ? `scheduled ${new Date(e.at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`
                        : "published"}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {docs !== undefined &&
        docs.length === 0 &&
        noteEvents !== undefined &&
        noteEvents.length === 0 && (
          <div className="mt-10 text-center text-sm text-muted-foreground">
            Nothing on the calendar yet. Schedule a post or give a task a due
            date.
          </div>
        )}
    </div>
  );
}
