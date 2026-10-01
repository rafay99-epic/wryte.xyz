"use client";

import type { GroupRow } from "@wryte/backend/cms/notes/_lib/model";
import { type NotesView, sameView } from "@wryte/logic/lib/notes/views";
import { cn } from "@wryte/logic/lib/utils";
import { useNotesViewStore } from "@wryte/logic/stores/notes-view-store";
import { Input } from "@wryte/ui/input";
import {
  CalendarClock,
  Inbox,
  ListTodo,
  type LucideIcon,
  Pin,
  Plus,
  Trash2,
} from "lucide-react";
import { useRef, useState } from "react";
import { useGroupActions } from "../hooks/use-group-actions";
import { useNotesRailData } from "../hooks/use-notes-rail";
import { GroupItem } from "./group-item";

const EMPTY_GROUPS: readonly GroupRow[] = [];

export function NotesRail({ view }: { view: NotesView }) {
  const { rail } = useNotesRailData();
  const setView = useNotesViewStore((state) => state.setView);
  const groups = rail?.groups ?? EMPTY_GROUPS;
  const actions = useGroupActions(groups);
  const openTasks = rail ? rail.stats.todo + rail.stats.doing : undefined;

  const item = (target: NotesView, icon: LucideIcon, label: string) => (
    <RailButton
      icon={icon}
      label={label}
      active={sameView(view, target)}
      onClick={() => setView(target)}
      {...(target.kind === "tasks" && openTasks ? { count: openTasks } : {})}
    />
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-2 slim-scrollbar">
      <ul className="space-y-0.5">
        {item({ kind: "all" }, Inbox, "All notes")}
        {item({ kind: "pinned" }, Pin, "Pinned")}
        {item({ kind: "tasks" }, ListTodo, "Tasks")}
        {item({ kind: "today" }, CalendarClock, "Due today")}
      </ul>

      <div className="my-2 h-px bg-border/50" />

      <ul className="space-y-0.5" aria-label="Groups">
        {groups.map((group, index) => (
          <GroupItem
            key={group._id}
            group={group}
            active={view.kind === "group" && view.groupId === group._id}
            first={index === 0}
            last={index === groups.length - 1}
            onSelect={() => setView({ kind: "group", groupId: group._id })}
            actions={actions}
          />
        ))}
      </ul>
      <NewGroupInput onCreate={actions.create} />

      <div className="my-2 h-px bg-border/50" />

      <ul>{item({ kind: "trash" }, Trash2, "Trash")}</ul>
    </div>
  );
}

function RailButton({
  icon: Icon,
  label,
  count,
  active,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  count?: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        aria-current={active ? "true" : undefined}
        className={cn(
          "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
          active
            ? "bg-muted font-medium text-foreground"
            : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
        )}
      >
        <Icon aria-hidden className="size-3.5 shrink-0" />
        <span className="min-w-0 flex-1 truncate">{label}</span>
        {count !== undefined && (
          <span className="text-xs tabular-nums text-muted-foreground">
            {count}
          </span>
        )}
      </button>
    </li>
  );
}

function NewGroupInput({
  onCreate,
}: {
  onCreate: (name: string) => Promise<boolean>;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const submittingRef = useRef(false);

  async function submit() {
    const trimmed = name.trim();
    if (submittingRef.current) return;
    if (!trimmed) {
      setEditing(false);
      return;
    }
    submittingRef.current = true;
    const created = await onCreate(trimmed);
    submittingRef.current = false;
    if (created) {
      setName("");
      setEditing(false);
    }
  }

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="mt-0.5 flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] text-muted-foreground outline-none hover:bg-muted/50 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
      >
        <Plus aria-hidden className="size-3.5" />
        New group
      </button>
    );
  }

  return (
    <Input
      ref={(element) => element?.focus()}
      aria-label="Group name"
      placeholder="Group name"
      value={name}
      maxLength={60}
      onChange={(event) => setName(event.target.value)}
      onBlur={() => void submit()}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          void submit();
        }
        if (event.key === "Escape") {
          setName("");
          setEditing(false);
        }
      }}
      className="mt-0.5 h-7 text-xs"
    />
  );
}
