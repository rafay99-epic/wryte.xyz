import type { Id } from "@wryte/backend/_generated/dataModel";
import type {
  GroupRow,
  NoteRow,
  NoteStatus,
} from "@wryte/backend/cms/notes/_lib/model";
import { getColorClasses } from "@wryte/logic/lib/board-colors";
import { dueLabel, isOverdue } from "@wryte/logic/lib/notes/dates";
import { notePath } from "@wryte/logic/lib/notes/views";
import { relativeTimeCompact } from "@wryte/logic/lib/relative-time";
import { cn } from "@wryte/logic/lib/utils";
import { CalendarClock, CircleAlert, FileText, Pin } from "lucide-react";
import Link from "next/link";
import { memo } from "react";
import type { NoteRowActions } from "../hooks/use-note-update";
import { DueDateInput } from "./due-date-input";
import { StatusToggle } from "./status-toggle";

type NoteRowsProps = NoteRowActions & {
  rows: readonly NoteRow[];
  groupsById: ReadonlyMap<Id<"note_groups">, GroupRow> | undefined;
  selectedId: string | null;
  today: string;
  editableDue?: boolean;
};

export function NoteRows({
  rows,
  groupsById,
  selectedId,
  today,
  editableDue = false,
  onStatusChange,
  onDueChange,
}: NoteRowsProps) {
  return (
    <ul>
      {rows.map((row) => {
        const group =
          row.groupId === undefined ? undefined : groupsById?.get(row.groupId);
        return (
          <NoteListRow
            key={row._id}
            noteId={row._id}
            title={row.title}
            excerpt={row.excerpt}
            status={row.status}
            dueDate={row.dueDate}
            pinned={row.pinned ?? false}
            updatedAt={row.updatedAt}
            groupName={group?.name}
            groupColor={group?.color}
            selected={row._id === selectedId}
            today={today}
            editableDue={editableDue}
            onStatusChange={onStatusChange}
            onDueChange={onDueChange}
          />
        );
      })}
    </ul>
  );
}

type NoteListRowProps = NoteRowActions & {
  noteId: Id<"notes">;
  title: string;
  excerpt: string;
  status: NoteStatus | undefined;
  dueDate: string | undefined;
  pinned: boolean;
  updatedAt: number;
  groupName: string | undefined;
  groupColor: string | undefined;
  selected: boolean;
  today: string;
  editableDue: boolean;
};

const NoteListRow = memo(function NoteListRow({
  noteId,
  title,
  excerpt,
  status,
  dueDate,
  pinned,
  updatedAt,
  groupName,
  groupColor,
  selected,
  today,
  editableDue,
  onStatusChange,
  onDueChange,
}: NoteListRowProps) {
  const overdue = isOverdue({ status, dueDate }, today);
  const done = status === "done";

  return (
    <li
      className={cn(
        "flex items-start gap-2 border-b border-border/40 px-3 py-2",
        selected ? "bg-muted/70" : "hover:bg-muted/30",
      )}
    >
      {status ? (
        <StatusToggle
          status={status}
          title={title}
          onChange={(next) => onStatusChange(noteId, next)}
        />
      ) : (
        <span className="flex size-6 shrink-0 items-center justify-center">
          <FileText aria-hidden className="size-3.5 text-muted-foreground" />
        </span>
      )}
      <Link
        href={notePath(noteId)}
        aria-current={selected ? "page" : undefined}
        className="min-w-0 flex-1 rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
      >
        <span
          className={cn(
            "block truncate text-sm",
            done ? "text-muted-foreground line-through" : "text-foreground",
          )}
        >
          {title || "Untitled"}
        </span>
        {excerpt && !status && (
          <span className="block truncate text-xs text-muted-foreground">
            {excerpt}
          </span>
        )}
        <span className="mt-0.5 flex items-center gap-2 text-[11px] text-muted-foreground">
          {pinned && (
            <span className="flex items-center gap-0.5">
              <Pin aria-hidden className="size-3" />
              <span className="sr-only">Pinned</span>
            </span>
          )}
          {groupName && (
            <span className="flex min-w-0 items-center gap-1">
              <span
                aria-hidden
                className={cn(
                  "size-1.5 shrink-0 rounded-full",
                  groupColor ? getColorClasses(groupColor).dot : "bg-border",
                )}
              />
              <span className="truncate">{groupName}</span>
            </span>
          )}
          {dueDate && !editableDue && (
            <span
              className={cn(
                "flex shrink-0 items-center gap-0.5",
                overdue && "text-red-400",
              )}
            >
              {overdue ? (
                <CircleAlert aria-hidden className="size-3" />
              ) : (
                <CalendarClock aria-hidden className="size-3" />
              )}
              {dueLabel(dueDate, today)}
              {overdue && <span className="sr-only">, overdue</span>}
            </span>
          )}
          <span className="ml-auto shrink-0 tabular-nums">
            {relativeTimeCompact(updatedAt)}
          </span>
        </span>
      </Link>
      {editableDue && (
        <div className="flex shrink-0 flex-col items-end gap-0.5">
          <DueDateInput
            value={dueDate}
            label={`Due date for ${title || "Untitled"}`}
            onChange={(next) => onDueChange(noteId, next)}
            className={cn(overdue && "border-red-400/60 text-red-400")}
          />
          {overdue && (
            <span className="flex items-center gap-0.5 text-[11px] text-red-400">
              <CircleAlert aria-hidden className="size-3" />
              Overdue
            </span>
          )}
        </div>
      )}
    </li>
  );
});
