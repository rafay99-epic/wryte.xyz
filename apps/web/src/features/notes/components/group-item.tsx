"use client";

import type { GroupRow } from "@wryte/backend/cms/notes/_lib/model";
import { BOARD_COLORS, getColorClasses } from "@wryte/logic/lib/board-colors";
import { cn } from "@wryte/logic/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@wryte/ui/dropdown-menu";
import { Input } from "@wryte/ui/input";
import {
  ArrowDown,
  ArrowUp,
  MoreHorizontal,
  Palette,
  Pencil,
  Share2,
  Trash2,
} from "lucide-react";
import { useRef, useState } from "react";
import { ConfirmActionDialog } from "@/components/settings/confirm-action-dialog";
import type { useGroupActions } from "../hooks/use-group-actions";

const NO_COLOR = "none";

export function GroupItem({
  group,
  active,
  first,
  last,
  onSelect,
  onShare,
  actions,
}: {
  group: GroupRow;
  active: boolean;
  first: boolean;
  last: boolean;
  onSelect: () => void;
  onShare: () => void;
  actions: ReturnType<typeof useGroupActions>;
}) {
  const [renaming, setRenaming] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  if (renaming) {
    return (
      <li>
        <RenameInput
          initial={group.name}
          onDone={async (name) => {
            if (name && name !== group.name) {
              await actions.rename(group._id, name);
            }
            setRenaming(false);
          }}
        />
      </li>
    );
  }

  return (
    <li
      className={cn(
        "group/item flex items-center rounded-md",
        active ? "bg-muted" : "hover:bg-muted/50",
      )}
    >
      <button
        type="button"
        onClick={onSelect}
        aria-current={active ? "true" : undefined}
        className={cn(
          "flex min-w-0 flex-1 items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
          active
            ? "font-medium text-foreground"
            : "text-muted-foreground hover:text-foreground",
        )}
      >
        <span
          aria-hidden
          className={cn(
            "size-2 shrink-0 rounded-full",
            group.color ? getColorClasses(group.color).dot : "bg-border",
          )}
        />
        <span className="min-w-0 flex-1 truncate">{group.name}</span>
        <span className="text-xs tabular-nums text-muted-foreground">
          {group.noteCount}
        </span>
      </button>
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label={`${group.name} options`}
          className="mr-1 flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground opacity-0 outline-none hover:bg-muted hover:text-foreground focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring/50 group-hover/item:opacity-100 aria-expanded:opacity-100"
        >
          <MoreHorizontal className="size-3.5" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuItem onClick={() => setRenaming(true)}>
            <Pencil />
            Rename
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onShare}>
            <Share2 />
            Share group
          </DropdownMenuItem>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <Palette />
              Color
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="max-h-72 overflow-y-auto">
              <DropdownMenuRadioGroup
                value={group.color ?? NO_COLOR}
                onValueChange={(value: string) =>
                  void actions.setColor(
                    group._id,
                    value === NO_COLOR ? null : value,
                  )
                }
              >
                <DropdownMenuRadioItem value={NO_COLOR}>
                  <span aria-hidden className="size-2 rounded-full bg-border" />
                  No color
                </DropdownMenuRadioItem>
                {BOARD_COLORS.map((color) => (
                  <DropdownMenuRadioItem key={color} value={color}>
                    <span
                      aria-hidden
                      className={cn(
                        "size-2 rounded-full",
                        getColorClasses(color).dot,
                      )}
                    />
                    <span className="capitalize">{color}</span>
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          <DropdownMenuItem
            disabled={first}
            onClick={() => void actions.move(group._id, -1)}
          >
            <ArrowUp />
            Move up
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={last}
            onClick={() => void actions.move(group._id, 1)}
          >
            <ArrowDown />
            Move down
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            onClick={() => setConfirmOpen(true)}
          >
            <Trash2 />
            Delete group
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <ConfirmActionDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={`Delete "${group.name}"?`}
        description="Its notes stay and move out of the group."
        confirmLabel="Delete group"
        onConfirm={() => void actions.remove(group._id)}
      />
    </li>
  );
}

function RenameInput({
  initial,
  onDone,
}: {
  initial: string;
  onDone: (name: string) => Promise<void>;
}) {
  const [name, setName] = useState(initial);
  const doneRef = useRef(false);

  function finish(value: string) {
    if (doneRef.current) return;
    doneRef.current = true;
    void onDone(value.trim());
  }

  return (
    <Input
      ref={(element) => element?.focus()}
      aria-label="Group name"
      value={name}
      maxLength={60}
      onChange={(event) => setName(event.target.value)}
      onBlur={() => finish(name)}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          finish(name);
        }
        if (event.key === "Escape") finish(initial);
      }}
      className="h-7 text-xs"
    />
  );
}
