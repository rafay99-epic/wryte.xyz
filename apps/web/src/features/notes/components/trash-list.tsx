"use client";

import { api } from "@wryte/backend/_generated/api";
import type { Id } from "@wryte/backend/_generated/dataModel";
import { NOTES_PAGE_SIZE } from "@wryte/logic/lib/notes/views";
import { relativeTimeCompact } from "@wryte/logic/lib/relative-time";
import { Button } from "@wryte/ui/button";
import { useConvexAuth, useMutation, usePaginatedQuery } from "convex/react";
import { RotateCcw, Trash2 } from "lucide-react";
import { memo, useCallback, useState } from "react";
import { toast } from "sonner";
import { ConfirmActionDialog } from "@/components/settings/confirm-action-dialog";
import { ListFooter, ListMessage } from "./list-status";

type PendingPurge = { noteId: Id<"notes">; title: string };

export function TrashList() {
  const { isAuthenticated } = useConvexAuth();
  const { results, status, loadMore } = usePaginatedQuery(
    api.cms.notes.notes.trashList,
    isAuthenticated ? {} : "skip",
    { initialNumItems: NOTES_PAGE_SIZE },
  );
  const restore = useMutation(api.cms.notes.notes.restore);
  const purge = useMutation(api.cms.notes.notes.purge);
  const [pending, setPending] = useState<PendingPurge | null>(null);

  const onRestore = useCallback(
    (noteId: Id<"notes">) => {
      restore({ noteId }).catch(() => {
        toast.error("Couldn't restore the note");
      });
    },
    [restore],
  );

  const onPurge = useCallback((noteId: Id<"notes">, title: string) => {
    setPending({ noteId, title });
  }, []);

  if (status === "LoadingFirstPage") return <ListMessage>Loading</ListMessage>;

  return (
    <div className="mx-auto w-full max-w-3xl">
      {results.length === 0 ? (
        <ListMessage>Trash is empty</ListMessage>
      ) : (
        <ul>
          {results.map((row) => (
            <TrashRow
              key={row._id}
              noteId={row._id}
              title={row.title}
              trashedAt={row.trashedAt}
              onRestore={onRestore}
              onPurge={onPurge}
            />
          ))}
        </ul>
      )}
      <ListFooter
        status={status}
        onLoadMore={() => loadMore(NOTES_PAGE_SIZE)}
      />
      <ConfirmActionDialog
        open={pending !== null}
        onOpenChange={(open) => {
          if (!open) setPending(null);
        }}
        title="Delete forever?"
        description={`"${pending?.title || "Untitled"}" will be deleted. This cannot be undone.`}
        confirmLabel="Delete forever"
        onConfirm={() => {
          if (!pending) return;
          purge({ noteId: pending.noteId }).catch(() => {
            toast.error("Couldn't delete the note");
          });
        }}
      />
    </div>
  );
}

export function EmptyTrashButton() {
  const emptyTrash = useMutation(api.cms.notes.notes.emptyTrash);
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        className="text-destructive hover:text-destructive"
        onClick={() => setOpen(true)}
      >
        <Trash2 />
        Empty trash
      </Button>
      <ConfirmActionDialog
        open={open}
        onOpenChange={setOpen}
        title="Empty trash?"
        description="Every note in the trash will be deleted. This cannot be undone."
        confirmLabel="Empty trash"
        onConfirm={() => {
          emptyTrash({}).catch(() => {
            toast.error("Couldn't empty the trash");
          });
        }}
      />
    </>
  );
}

const TrashRow = memo(function TrashRow({
  noteId,
  title,
  trashedAt,
  onRestore,
  onPurge,
}: {
  noteId: Id<"notes">;
  title: string;
  trashedAt: number;
  onRestore: (noteId: Id<"notes">) => void;
  onPurge: (noteId: Id<"notes">, title: string) => void;
}) {
  const label = title || "Untitled";
  return (
    <li className="flex items-center gap-2 border-b border-border/40 px-3 py-2">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm text-foreground">{label}</p>
        <p className="text-[11px] text-muted-foreground tabular-nums">
          Deleted {relativeTimeCompact(trashedAt)} ago
        </p>
      </div>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={`Restore ${label}`}
        title="Restore"
        onClick={() => onRestore(noteId)}
      >
        <RotateCcw />
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={`Delete ${label} forever`}
        title="Delete forever"
        className="text-destructive hover:text-destructive"
        onClick={() => onPurge(noteId, title)}
      >
        <Trash2 />
      </Button>
    </li>
  );
});
