"use client";

import type { Id } from "@wryte/backend/_generated/dataModel";
import type { GroupRow } from "@wryte/backend/cms/notes/_lib/model";
import { getColorClasses } from "@wryte/logic/lib/board-colors";
import { cn } from "@wryte/logic/lib/utils";
import { useNotesViewStore } from "@wryte/logic/stores/notes-view-store";
import { Button } from "@wryte/ui/button";
import { Input } from "@wryte/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@wryte/ui/popover";
import { ChevronDown, Plus } from "lucide-react";
import { useRef, useState } from "react";
import { useGroupActions } from "../hooks/use-group-actions";
import { useNotesRailData } from "../hooks/use-notes-rail";
import { GroupItem } from "./group-item";

const EMPTY_GROUPS: readonly GroupRow[] = [];

export function GroupFilter({
  groupId,
}: {
  groupId: Id<"note_groups"> | null;
}) {
  const { rail, groupsById } = useNotesRailData();
  const setGroupId = useNotesViewStore((state) => state.setGroupId);
  const groups = rail?.groups ?? EMPTY_GROUPS;
  const actions = useGroupActions(groups);
  const [open, setOpen] = useState(false);
  const current = groupId ? groupsById?.get(groupId) : undefined;

  function select(next: Id<"note_groups"> | null) {
    setGroupId(next);
    setOpen(false);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            variant="outline"
            size="lg"
            aria-label={`Group filter: ${current?.name ?? "All groups"}`}
            className="border-white/10 bg-white/[0.03]"
          />
        }
      >
        {current && <GroupDot color={current.color} />}
        <span className="max-w-40 truncate">
          {current?.name ?? "All groups"}
        </span>
        <ChevronDown className="text-muted-foreground" />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 gap-0 p-1">
        <button
          type="button"
          onClick={() => select(null)}
          aria-current={groupId === null ? "true" : undefined}
          className={cn(
            "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
            groupId === null
              ? "bg-muted font-medium text-foreground"
              : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
          )}
        >
          All groups
        </button>
        {groups.length > 0 && (
          <ul className="mt-0.5 space-y-0.5" aria-label="Groups">
            {groups.map((group, index) => (
              <GroupItem
                key={group._id}
                group={group}
                active={group._id === groupId}
                first={index === 0}
                last={index === groups.length - 1}
                onSelect={() => select(group._id)}
                actions={actions}
              />
            ))}
          </ul>
        )}
        <NewGroupInput onCreate={actions.create} />
      </PopoverContent>
    </Popover>
  );
}

export function GroupDot({ color }: { color: string | undefined }) {
  return (
    <span
      aria-hidden
      className={cn(
        "size-2 shrink-0 rounded-full",
        color ? getColorClasses(color).dot : "bg-border",
      )}
    />
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
          event.stopPropagation();
          setName("");
          setEditing(false);
        }
      }}
      className="mt-0.5 h-7 text-xs"
    />
  );
}
