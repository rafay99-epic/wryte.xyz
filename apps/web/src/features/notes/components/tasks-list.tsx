"use client";

import { api } from "@wryte/backend/_generated/api";
import type { NoteRow } from "@wryte/backend/cms/notes/_lib/model";
import { useAuthedQuery } from "@wryte/logic/hooks/use-authed-query";
import { NOTE_STATUS_LABELS } from "@wryte/logic/lib/notes/status";
import { dueByToday, sortByDue } from "@wryte/logic/lib/notes/views";
import { useMemo } from "react";
import { useNoteRowActions } from "../hooks/use-note-update";
import { useNotesRailData } from "../hooks/use-notes-rail";
import { ListMessage } from "./list-status";
import { NoteRows } from "./note-rows";
import { StatusIcon } from "./status-icon";

type Section = {
  status: "todo" | "doing" | "done";
  rows: NoteRow[];
};

export function TasksList({
  mode,
  selectedId,
  today,
}: {
  mode: "tasks" | "today";
  selectedId: string | null;
  today: string;
}) {
  const tasks = useAuthedQuery(api.cms.notes.notes.tasks, {});
  const { groupsById } = useNotesRailData();
  const actions = useNoteRowActions();

  const sections = useMemo<Section[] | undefined>(() => {
    if (!tasks) return undefined;
    if (mode === "today") {
      return [{ status: "todo", rows: dueByToday(tasks, today) }];
    }
    return [
      { status: "doing", rows: sortByDue(tasks.doing) },
      { status: "todo", rows: sortByDue(tasks.todo) },
      { status: "done", rows: tasks.done },
    ];
  }, [tasks, mode, today]);

  if (!sections) return <ListMessage>Loading</ListMessage>;

  if (sections.every((section) => section.rows.length === 0)) {
    return (
      <ListMessage>
        {mode === "today" ? "Nothing due today" : "No tasks yet"}
      </ListMessage>
    );
  }

  const rowProps = {
    groupsById,
    selectedId,
    today,
    editableDue: true,
    ...actions,
  };

  if (mode === "today") {
    return <NoteRows rows={sections[0]?.rows ?? []} {...rowProps} />;
  }

  return sections.map((section) =>
    section.rows.length === 0 ? null : (
      <section
        key={section.status}
        aria-label={NOTE_STATUS_LABELS[section.status]}
      >
        <h2 className="flex items-center gap-1.5 border-b border-border/40 px-3 pt-3 pb-1.5 text-xs font-medium text-foreground">
          <StatusIcon status={section.status} />
          {NOTE_STATUS_LABELS[section.status]}
          <span className="text-muted-foreground tabular-nums">
            {section.rows.length}
          </span>
        </h2>
        <NoteRows rows={section.rows} {...rowProps} />
      </section>
    ),
  );
}
