"use client";

import { api } from "@wryte/backend/_generated/api";
import type { NoteMeta } from "@wryte/backend/cms/notes/_lib/model";
import {
  isNoteStatus,
  NOTE_STATUS_LABELS,
  NOTE_STATUSES,
} from "@wryte/logic/lib/notes/status";
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
  FileOutput,
  ImageIcon,
  MoreHorizontal,
  Pin,
  Trash2,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useShallow } from "zustand/react/shallow";
import { useNoteUpdate } from "../hooks/use-note-update";
import { useNotesRailData } from "../hooks/use-notes-rail";
import { useOpenNote } from "../hooks/use-open-note";
import { ConvertToArticleDialog } from "./convert-to-article-dialog";
import { DueDateInput } from "./due-date-input";
import { GroupDot } from "./group-filter";
import { LinkedArticles } from "./linked-articles";
import { AddRefButton, NoteRefList } from "./note-refs";
import { StatusIcon } from "./status-icon";

const NONE = "none";

const PICKER_CLASS = "h-8 border-white/10 bg-white/[0.03] text-xs";

export function NoteHeader({
  meta,
  flushNow,
  onClose,
}: {
  meta: NoteMeta;
  flushNow: () => Promise<void>;
  onClose: () => void;
}) {
  const noteId = meta._id;
  const update = useNoteUpdate();
  const [convertOpen, setConvertOpen] = useState(false);

  return (
    <header className="shrink-0 px-6 pt-5 pb-3">
      <div className="flex flex-wrap items-center gap-2">
        <StatusPicker meta={meta} />
        <GroupPicker meta={meta} />
        <DueDateInput
          value={meta.dueDate}
          label="Due date"
          onChange={(dueDate) => void update({ noteId, dueDate })}
        />
        <div className="ml-auto flex items-center gap-0.5">
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
          <NoteMenu meta={meta} flushNow={flushNow} onClose={onClose} />
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Close note"
            title="Close (Esc)"
            onClick={onClose}
          >
            <X />
          </Button>
        </div>
      </div>
      <TitleInput focusOnMount={meta.title === ""} flushNow={flushNow} />
      <div className="mt-2 flex flex-wrap items-center gap-1">
        <LinkedArticles noteId={noteId} />
        <AddRefButton noteId={noteId} />
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
      <NoteRefList noteId={noteId} />
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
      className="mt-4 w-full bg-transparent text-xl font-semibold text-foreground outline-none placeholder:text-muted-foreground/60 placeholder:italic"
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
  onClose,
}: {
  meta: NoteMeta;
  flushNow: () => Promise<void>;
  onClose: () => void;
}) {
  const router = useRouter();
  const open = useOpenNote();
  const trash = useMutation(api.cms.notes.notes.trash);
  const restore = useMutation(api.cms.notes.notes.restore);
  const noteId = meta._id;

  async function moveToTrash() {
    try {
      await flushNow();
      await trash({ noteId });
      onClose();
      toast("Moved to trash", {
        action: {
          label: "Undo",
          onClick: () => {
            restore({ noteId })
              .then(() => open(noteId))
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
