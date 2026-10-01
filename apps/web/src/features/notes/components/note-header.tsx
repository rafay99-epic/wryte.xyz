"use client";

import { api } from "@wryte/backend/_generated/api";
import type { NoteMeta } from "@wryte/backend/cms/notes/_lib/model";
import { getColorClasses } from "@wryte/logic/lib/board-colors";
import {
  isNoteStatus,
  NOTE_STATUS_LABELS,
  NOTE_STATUSES,
} from "@wryte/logic/lib/notes/status";
import { NOTES_PATH, notePath } from "@wryte/logic/lib/notes/views";
import { cn } from "@wryte/logic/lib/utils";
import { useEditorStore } from "@wryte/logic/stores/editor-store";
import { Button } from "@wryte/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@wryte/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@wryte/ui/select";
import { useMutation } from "convex/react";
import {
  ArrowLeft,
  FileOutput,
  ImageIcon,
  MoreHorizontal,
  Pin,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useShallow } from "zustand/react/shallow";
import { useNoteUpdate } from "../hooks/use-note-update";
import { useNotesRailData } from "../hooks/use-notes-rail";
import { ConvertToArticleDialog } from "./convert-to-article-dialog";
import { DueDateInput } from "./due-date-input";
import { LinkedArticles } from "./linked-articles";
import { StatusIcon } from "./status-icon";

const NONE = "none";

const PICKER_CLASS = "h-7 border-border/60 text-xs";

export function NoteHeader({
  meta,
  flushNow,
}: {
  meta: NoteMeta;
  flushNow: () => Promise<void>;
}) {
  const noteId = meta._id;
  const update = useNoteUpdate();
  const [convertOpen, setConvertOpen] = useState(false);

  return (
    <header className="shrink-0 border-b border-border/50 px-3 py-2 sm:px-4">
      <div className="flex items-center gap-1.5">
        <Link
          href={NOTES_PATH}
          aria-label="Back to notes"
          className="flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground lg:hidden"
        >
          <ArrowLeft className="size-4" />
        </Link>
        <TitleInput focusOnMount={meta.title === ""} flushNow={flushNow} />
        <SaveState />
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Pin note"
          aria-pressed={meta.pinned === true}
          title={meta.pinned ? "Unpin" : "Pin"}
          onClick={() => void update({ noteId, pinned: !meta.pinned })}
        >
          <Pin
            className={cn(meta.pinned && "text-foreground")}
            fill={meta.pinned ? "currentColor" : "none"}
          />
        </Button>
        <NoteMenu meta={meta} flushNow={flushNow} />
      </div>
      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
        <GroupPicker meta={meta} />
        <StatusPicker meta={meta} />
        <DueDateInput
          value={meta.dueDate}
          label="Due date"
          onChange={(dueDate) => void update({ noteId, dueDate })}
        />
        <LinkedArticles noteId={noteId} />
        <Button
          variant="ghost"
          size="xs"
          className="text-muted-foreground"
          onClick={() => setConvertOpen(true)}
        >
          <FileOutput />
          Convert to article
        </Button>
      </div>
      <ConvertToArticleDialog
        open={convertOpen}
        onOpenChange={setConvertOpen}
        meta={meta}
        flushNow={flushNow}
      />
    </header>
  );
}

function TitleInput({
  focusOnMount,
  flushNow,
}: {
  focusOnMount: boolean;
  flushNow: () => Promise<void>;
}) {
  const { title, setTitle } = useEditorStore(
    useShallow((state) => ({ title: state.title, setTitle: state.setTitle })),
  );
  const inputRef = useRef<HTMLInputElement>(null);
  const focusRef = useRef(focusOnMount);

  useEffect(() => {
    if (focusRef.current) inputRef.current?.focus();
  }, []);

  return (
    <input
      ref={inputRef}
      value={title}
      maxLength={200}
      placeholder="Untitled"
      aria-label="Note title"
      onChange={(event) => setTitle(event.target.value)}
      onBlur={() => void flushNow()}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          event.currentTarget.blur();
        }
      }}
      className="min-w-0 flex-1 bg-transparent px-1 text-lg font-semibold text-foreground outline-none placeholder:text-muted-foreground/60"
    />
  );
}

function SaveState() {
  const label = useEditorStore((state) =>
    state.isSaving ? "Saving" : state.isDirty ? "Unsaved" : "Saved",
  );
  return (
    <span
      role="status"
      className="shrink-0 px-1 text-[11px] text-muted-foreground"
    >
      {label}
    </span>
  );
}

function GroupPicker({ meta }: { meta: NoteMeta }) {
  const { rail } = useNotesRailData();
  const update = useNoteUpdate();
  const groups = rail?.groups ?? [];
  const current = groups.find((group) => group._id === meta.groupId);

  return (
    <Select
      value={meta.groupId ?? NONE}
      onValueChange={(value) => {
        const group = groups.find((item) => item._id === value);
        void update({ noteId: meta._id, groupId: group ? group._id : null });
      }}
    >
      <SelectTrigger size="sm" aria-label="Group" className={PICKER_CLASS}>
        <SelectValue>
          {current ? (
            <>
              <GroupDot color={current.color} />
              {current.name}
            </>
          ) : (
            "No group"
          )}
        </SelectValue>
      </SelectTrigger>
      <SelectContent alignItemWithTrigger={false} align="start">
        <SelectItem value={NONE}>No group</SelectItem>
        {groups.map((group) => (
          <SelectItem key={group._id} value={group._id}>
            <GroupDot color={group.color} />
            {group.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function GroupDot({ color }: { color: string | undefined }) {
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

function StatusPicker({ meta }: { meta: NoteMeta }) {
  const update = useNoteUpdate();
  return (
    <Select
      value={meta.status ?? NONE}
      onValueChange={(value) => {
        void update({
          noteId: meta._id,
          status:
            typeof value === "string" && isNoteStatus(value) ? value : null,
        });
      }}
    >
      <SelectTrigger
        size="sm"
        aria-label="Task status"
        className={PICKER_CLASS}
      >
        <SelectValue>
          {meta.status ? (
            <>
              <StatusIcon status={meta.status} />
              {NOTE_STATUS_LABELS[meta.status]}
            </>
          ) : (
            "Not a task"
          )}
        </SelectValue>
      </SelectTrigger>
      <SelectContent alignItemWithTrigger={false} align="start">
        <SelectItem value={NONE}>Not a task</SelectItem>
        {NOTE_STATUSES.map((status) => (
          <SelectItem key={status} value={status}>
            <StatusIcon status={status} />
            {NOTE_STATUS_LABELS[status]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function NoteMenu({
  meta,
  flushNow,
}: {
  meta: NoteMeta;
  flushNow: () => Promise<void>;
}) {
  const router = useRouter();
  const trash = useMutation(api.cms.notes.notes.trash);
  const restore = useMutation(api.cms.notes.notes.restore);
  const noteId = meta._id;

  async function moveToTrash() {
    try {
      await flushNow();
      await trash({ noteId });
      router.push(NOTES_PATH);
      toast("Moved to trash", {
        action: {
          label: "Undo",
          onClick: () => {
            restore({ noteId })
              .then(() => router.push(notePath(noteId)))
              .catch(() => toast.error("Couldn't restore the note"));
          },
        },
      });
    } catch {
      toast.error("Couldn't move the note to trash");
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="ghost" size="icon-sm" aria-label="Note options" />
        }
      >
        <MoreHorizontal />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem onClick={() => router.push("/settings#media")}>
          <ImageIcon />
          Image settings
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          onClick={() => void moveToTrash()}
        >
          <Trash2 />
          Move to trash
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
