"use client";

import { useQuery } from "convex/react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DAYS,
  getDateKey,
  getDaysInMonth,
  getFirstDayOfMonth,
  isSameDay,
  MONTHS,
} from "@/lib/calendar-utils";
import { cn } from "@/lib/utils";
import { api } from "../../../convex/_generated/api";

/**
 * Fixed per-project dot palette for the global calendar. Assigned by the
 * project's position in the (stable, user-owned) project list; cycles past
 * the end. Amber is deliberately excluded — it marks "today" and scheduled
 * rings, and must never collide with a project color.
 */
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

/**
 * Cross-project month view: every published and scheduled post from all
 * projects on one grid. Read-only by design — rescheduling stays on the
 * per-project calendar, which owns drag-and-drop. Dates bucket in the
 * browser's timezone; the day panel shows exact times so nothing lies.
 */
export function GlobalCalendarPage() {
  const router = useRouter();
  const docs = useQuery(api.cms.documents.listForCalendarAllProjects, {});

  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

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
      // A doc can carry both dates (published once, rescheduled later) —
      // both events render; that's the real story, not a bug to dedupe.
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

      {/* Legend: dot color = project; filled = published, ring = scheduled. */}
      {projects.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
          {projects.slice(0, 5).map((p) => (
            <span key={p.id} className="flex items-center gap-1.5">
              <span className={cn("size-2 rounded-full", p.color)} />
              {p.name}
            </span>
          ))}
          {projects.length > 5 && <span>+{projects.length - 5} more</span>}
          <span className="ml-auto flex items-center gap-3">
            <span className="flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-muted-foreground" />
              published
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-2 rounded-full border border-muted-foreground" />
              scheduled
            </span>
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
          const isToday = isSameDay(date, today);
          const isSelected = selectedKey === key;
          return (
            <button
              key={key}
              type="button"
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
              {events.length > 0 && (
                <span className="mt-auto flex flex-wrap gap-1 pt-1">
                  {events.slice(0, 4).map((e) => (
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
                  {events.length > 4 && (
                    <span className="text-[9px] leading-none text-muted-foreground">
                      +{events.length - 4}
                    </span>
                  )}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Day panel — click a day, see its items, jump to the editor. */}
      {selectedKey && (
        <div className="mt-4 rounded-xl border border-border/40 bg-card p-4">
          {selectedEvents.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nothing published or scheduled this day.
            </p>
          ) : (
            <ul className="space-y-1.5">
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

      {docs !== undefined && docs.length === 0 && (
        <div className="mt-10 text-center text-sm text-muted-foreground">
          Nothing on the calendar yet — schedule or publish a post and it lands
          here.
        </div>
      )}
    </div>
  );
}
