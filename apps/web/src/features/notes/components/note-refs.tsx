"use client";

import { api } from "@wryte/backend/_generated/api";
import type { Id } from "@wryte/backend/_generated/dataModel";
import {
  MAX_NOTE_REFS,
  type NoteRef,
  type RefKind,
} from "@wryte/backend/cms/notes/_lib/model";
import { useAuthedQuery } from "@wryte/logic/hooks/use-authed-query";
import {
  isHttpUrl,
  REF_KIND_LABELS,
  REF_KINDS,
  refLabel,
} from "@wryte/logic/lib/notes/refs";
import { cn } from "@wryte/logic/lib/utils";
import { Button } from "@wryte/ui/button";
import { Input } from "@wryte/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@wryte/ui/popover";
import { Textarea } from "@wryte/ui/textarea";
import { useMutation } from "convex/react";
import { Plus, X } from "lucide-react";
import { type FormEvent, useState } from "react";
import { toast } from "sonner";
import { RefKindIcon } from "./ref-kind-icon";

export function NoteRefList({ noteId }: { noteId: Id<"notes"> }) {
  const refs = useAuthedQuery(api.cms.notes.refs.list, { noteId });
  const remove = useMutation(api.cms.notes.refs.remove);
  if (!refs?.length) return null;

  return (
    <ul aria-label="References" className="mt-1.5 space-y-px">
      {refs.map((ref) => (
        <RefRow
          key={ref._id}
          noteRef={ref}
          onRemove={() => {
            remove({ refId: ref._id }).catch(() => {
              toast.error("Couldn't remove the reference");
            });
          }}
        />
      ))}
    </ul>
  );
}

function RefRow({
  noteRef,
  onRemove,
}: {
  noteRef: NoteRef;
  onRemove: () => void;
}) {
  const label = refLabel(noteRef);
  const kindLabel = REF_KIND_LABELS[noteRef.kind];
  return (
    <li className="group/ref flex items-center gap-1.5 rounded-md px-1 py-0.5 text-xs hover:bg-muted/40">
      <RefKindIcon kind={noteRef.kind} className="text-muted-foreground" />
      <span className="sr-only">{kindLabel}</span>
      {noteRef.url ? (
        <a
          href={noteRef.url}
          target="_blank"
          rel="noreferrer"
          className="min-w-0 flex-1 truncate text-foreground hover:underline"
        >
          {label}
        </a>
      ) : (
        <span className="min-w-0 flex-1 truncate text-foreground">{label}</span>
      )}
      {noteRef.author && (
        <span className="max-w-32 shrink-0 truncate text-[11px] text-muted-foreground">
          {noteRef.author}
        </span>
      )}
      <button
        type="button"
        aria-label={`Remove ${kindLabel.toLowerCase()} ${label}`}
        onClick={onRemove}
        className="flex size-5 shrink-0 items-center justify-center rounded text-muted-foreground opacity-0 outline-none hover:text-foreground focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring/50 group-hover/ref:opacity-100"
      >
        <X className="size-3" />
      </button>
    </li>
  );
}

export function AddRefButton({ noteId }: { noteId: Id<"notes"> }) {
  const refs = useAuthedQuery(api.cms.notes.refs.list, { noteId });
  const [open, setOpen] = useState(false);
  const full = (refs?.length ?? 0) >= MAX_NOTE_REFS;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            variant="ghost"
            size="xs"
            className="text-muted-foreground"
            disabled={full}
            title={
              full ? `Up to ${String(MAX_NOTE_REFS)} references` : undefined
            }
          />
        }
      >
        <Plus />
        Reference
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 gap-2 p-2">
        {open && <AddRefForm noteId={noteId} onDone={() => setOpen(false)} />}
      </PopoverContent>
    </Popover>
  );
}

function AddRefForm({
  noteId,
  onDone,
}: {
  noteId: Id<"notes">;
  onDone: () => void;
}) {
  const add = useMutation(api.cms.notes.refs.add);
  const [kind, setKind] = useState<RefKind>("pr");
  const [url, setUrl] = useState("");
  const [text, setText] = useState("");
  const [author, setAuthor] = useState("");
  const [busy, setBusy] = useState(false);

  const comment = kind === "comment";
  const trimmedUrl = url.trim();
  const trimmedText = text.trim();
  const urlInvalid = trimmedUrl !== "" && !isHttpUrl(trimmedUrl);
  const ready = comment
    ? (trimmedText !== "" || trimmedUrl !== "") && !urlInvalid
    : trimmedUrl !== "" && !urlInvalid;

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!ready || busy) return;
    setBusy(true);
    try {
      const added = await add({
        noteId,
        refs: [
          {
            kind,
            ...(trimmedUrl ? { url: trimmedUrl } : {}),
            ...(comment && trimmedText ? { text: trimmedText } : {}),
            ...(comment && author.trim() ? { author: author.trim() } : {}),
          },
        ],
      });
      if (added.length === 0) toast("Already added");
      onDone();
    } catch (error) {
      console.error("[Notes] Add reference failed:", error);
      toast.error("Couldn't add the reference");
      setBusy(false);
    }
  }

  return (
    <form className="grid gap-2" onSubmit={(event) => void submit(event)}>
      <div
        role="radiogroup"
        aria-label="Reference type"
        className="grid grid-cols-4 gap-0.5 rounded-md border border-border/60 p-0.5"
      >
        {REF_KINDS.map((option) => {
          const active = option === kind;
          return (
            <button
              key={option}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => setKind(option)}
              className={cn(
                "flex items-center justify-center gap-1 rounded px-1 py-1 text-[11px] outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                active
                  ? "bg-muted text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <RefKindIcon kind={option} className="size-3" />
              {option === "pr" ? "PR" : REF_KIND_LABELS[option]}
            </button>
          );
        })}
      </div>
      {comment && (
        <Textarea
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="Comment text"
          aria-label="Comment text"
          maxLength={2000}
          rows={3}
          className="min-h-16 text-xs"
        />
      )}
      <Input
        ref={(element) => {
          if (!comment) element?.focus();
        }}
        value={url}
        onChange={(event) => setUrl(event.target.value)}
        placeholder={comment ? "Link to the comment (optional)" : "https://"}
        aria-label="URL"
        aria-invalid={urlInvalid}
        maxLength={500}
        className="h-7 text-xs"
      />
      {urlInvalid && (
        <p className="text-[11px] text-red-400">Use a full http or https URL</p>
      )}
      {comment && (
        <Input
          value={author}
          onChange={(event) => setAuthor(event.target.value)}
          placeholder="Author (optional)"
          aria-label="Author"
          maxLength={100}
          className="h-7 text-xs"
        />
      )}
      <div className="flex justify-end">
        <Button type="submit" size="sm" disabled={!ready || busy}>
          {busy ? "Adding" : "Add"}
        </Button>
      </div>
    </form>
  );
}
