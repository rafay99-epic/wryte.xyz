"use client";

import type { Id } from "@wryte/backend/_generated/dataModel";
import type {
  BoardCard,
  BoardColumn,
} from "@wryte/backend/cms/notes/_lib/model";
import {
  BOARD_COLUMN_LABELS,
  BOARD_COLUMNS,
  type BoardColumns,
} from "@wryte/logic/lib/notes/board";
import { COLUMN_TONES } from "@wryte/logic/lib/notes/colors";
import { noteCountLabel } from "@wryte/logic/lib/notes/shares";
import { cn } from "@wryte/logic/lib/utils";
import { Button } from "@wryte/ui/button";
import {
  Kanban,
  KanbanBoard,
  KanbanColumn,
  KanbanColumnContent,
  KanbanOverlay,
} from "@wryte/ui/kanban";
import { Plus, Share2 } from "lucide-react";
import { type ReactNode, useCallback, useMemo, useRef, useState } from "react";
import { useBoardAnnouncements } from "../hooks/use-board-announcements";
import { useCreateNote } from "../hooks/use-create-note";
import { useNoteSelection } from "../hooks/use-note-selection";
import { useNotesBoard } from "../hooks/use-notes-board";
import { useNotesRailData } from "../hooks/use-notes-rail";
import { useOpenNote } from "../hooks/use-open-note";
import { BoardHeader } from "./board-header";
import { NoteCard } from "./note-card";
import { ShareDialog } from "./share-dialog";
import { StatusIcon } from "./status-icon";

type Columns = Record<string, BoardCard[]>;

type Preview = { base: BoardColumns; value: Columns };

const CLICK_GUARD_MS = 250;

const EMPTY: BoardCard[] = [];

const cardId = (card: BoardCard) => card._id;

export function NotesBoard({
  groupId,
  selectedId,
  today,
}: {
  groupId: Id<"note_groups"> | null;
  selectedId: string | null;
  today: string;
}) {
  const { columns, hasMore, loadMore, loading, commit } =
    useNotesBoard(groupId);
  const { groupsById } = useNotesRailData();
  const open = useOpenNote();
  const createNote = useCreateNote();
  const [preview, setPreview] = useState<Preview | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const lastDragEndRef = useRef(0);
  const selection = useNoteSelection();
  const { toggle } = selection;
  const [shareOpen, setShareOpen] = useState(false);

  const value = useMemo<Columns | undefined>(() => {
    if (!columns) return undefined;
    if (preview && (activeId !== null || preview.base === columns)) {
      return preview.value;
    }
    return columns;
  }, [columns, preview, activeId]);

  const onValueChange = useCallback(
    (next: Columns) => {
      if (columns) setPreview({ base: columns, value: next });
    },
    [columns],
  );

  const endDrag = useCallback(() => {
    lastDragEndRef.current = performance.now();
    setActiveId(null);
  }, []);

  const onOpen = useCallback(
    (noteId: string) => {
      if (performance.now() - lastDragEndRef.current < CLICK_GUARD_MS) return;
      open(noteId);
    },
    [open],
  );

  const onToggle = useCallback(
    (noteId: Id<"notes">) => {
      if (performance.now() - lastDragEndRef.current < CLICK_GUARD_MS) return;
      toggle(noteId);
    },
    [toggle],
  );

  const announcements = useBoardAnnouncements(value);
  const accessibility = useMemo(() => ({ announcements }), [announcements]);

  const cardById = useMemo(() => {
    const map = new Map<string, BoardCard>();
    for (const cards of Object.values(value ?? {})) {
      for (const card of cards) map.set(card._id, card);
    }
    return map;
  }, [value]);

  const total = BOARD_COLUMNS.reduce(
    (sum, column) => sum + (value?.[column]?.length ?? 0),
    0,
  );
  const anyMore = BOARD_COLUMNS.some(hasMore);
  const count = value ? `${String(total)}${anyMore ? "+" : ""}` : null;

  const overColumn =
    activeId === null
      ? null
      : (BOARD_COLUMNS.find((column) =>
          value?.[column]?.some((card) => card._id === activeId),
        ) ?? null);

  const groupOf = (card: BoardCard) =>
    groupId === null && card.groupId !== undefined
      ? groupsById?.get(card.groupId)
      : undefined;

  return (
    <>
      <BoardHeader
        groupId={groupId}
        trash={false}
        count={count}
        selecting={selection.selecting}
        onSelectingChange={selection.setMode}
      />
      {selection.selecting && (
        <SelectionBar
          count={selection.selected.size}
          full={selection.full}
          onShare={() => setShareOpen(true)}
          onClear={selection.clear}
          onDone={() => selection.setMode(false)}
        />
      )}
      <ShareDialog
        open={shareOpen}
        onOpenChange={setShareOpen}
        target={{
          kind: "notes",
          noteIds: [...selection.selected],
          label: noteCountLabel(selection.selected.size),
        }}
      />
      {value ? (
        <Kanban
          value={value}
          onValueChange={onValueChange}
          getItemValue={cardId}
          onValueCommit={commit}
          restoreOnCancel
          accessibility={accessibility}
          onDragStart={(event) => setActiveId(String(event.active.id))}
          onDragEnd={endDrag}
          onDragCancel={endDrag}
          className="flex min-h-0 min-w-0 flex-1"
        >
          <KanbanBoard className="flex min-h-0 min-w-0 flex-1 gap-4 overflow-x-auto px-6 pb-6 slim-scrollbar">
            {BOARD_COLUMNS.map((column) => {
              const cards = value[column] ?? EMPTY;
              const more = hasMore(column);
              return (
                <BoardColumnShell
                  key={column}
                  column={column}
                  count={cards.length}
                  more={more}
                  over={overColumn === column}
                  onCreate={() => void createNote(column, groupId)}
                >
                  <KanbanColumnContent value={column} className="gap-2.5">
                    {cards.length === 0 ? (
                      <EmptyColumn
                        label={
                          activeId !== null
                            ? "Drop here"
                            : column === "notes"
                              ? "No notes"
                              : "No tasks"
                        }
                      />
                    ) : (
                      cards.map((card) => (
                        <NoteCard
                          key={card._id}
                          card={card}
                          group={groupOf(card)}
                          selected={card._id === selectedId}
                          today={today}
                          selecting={selection.selecting}
                          checked={selection.selected.has(card._id)}
                          onOpen={onOpen}
                          onToggle={onToggle}
                        />
                      ))
                    )}
                  </KanbanColumnContent>
                  {more && (
                    <button
                      type="button"
                      disabled={loading[column] === true}
                      onClick={() => loadMore(column)}
                      className="mt-2.5 w-full rounded-lg py-2 text-xs text-muted-foreground outline-none transition-colors duration-150 hover:bg-white/[0.04] hover:text-foreground focus-visible:ring-2 focus-visible:ring-white/20 disabled:opacity-60"
                    >
                      {loading[column] ? "Loading" : "Load more"}
                    </button>
                  )}
                </BoardColumnShell>
              );
            })}
          </KanbanBoard>
          <KanbanOverlay>
            {({ value: dragged }) => {
              const card = cardById.get(String(dragged));
              return card ? (
                <NoteCard
                  card={card}
                  group={groupOf(card)}
                  selected={false}
                  today={today}
                  overlay
                />
              ) : null;
            }}
          </KanbanOverlay>
        </Kanban>
      ) : (
        <BoardSkeleton />
      )}
    </>
  );
}

const COLUMN_CLASS =
  "min-h-0 min-w-[220px] flex-1 rounded-xl border border-white/[0.06] p-3 transition-colors duration-150";

function BoardColumnShell({
  column,
  count,
  more,
  over,
  onCreate,
  children,
}: {
  column: BoardColumn;
  count: number;
  more: boolean;
  over: boolean;
  onCreate: () => void;
  children: ReactNode;
}) {
  const tone = COLUMN_TONES[column];
  const label = BOARD_COLUMN_LABELS[column];
  return (
    <KanbanColumn
      value={column}
      aria-label={label}
      className={cn(COLUMN_CLASS, over ? tone.over : tone.tint)}
    >
      <div className="flex h-7 shrink-0 items-center gap-2 px-1">
        <StatusIcon status={column} />
        <h2 className="text-sm font-medium text-foreground">{label}</h2>
        <span className="rounded-md bg-white/[0.06] px-1.5 py-px text-[11px] text-muted-foreground tabular-nums">
          {count}
          {more ? "+" : ""}
        </span>
        <button
          type="button"
          aria-label={column === "notes" ? "New note" : `New task in ${label}`}
          onClick={onCreate}
          className="ml-auto flex size-7 items-center justify-center rounded-md text-muted-foreground opacity-0 outline-none transition-opacity duration-150 group-hover/kanban-column:opacity-100 hover:bg-white/[0.06] hover:text-foreground focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-white/20"
        >
          <Plus className="size-4" />
        </button>
      </div>
      <div className="-mx-1 mt-2 min-h-0 flex-1 overflow-y-auto px-1 pt-px pb-1 slim-scrollbar">
        {children}
      </div>
    </KanbanColumn>
  );
}

function SelectionBar({
  count,
  full,
  onShare,
  onClear,
  onDone,
}: {
  count: number;
  full: boolean;
  onShare: () => void;
  onClear: () => void;
  onDone: () => void;
}) {
  return (
    <div
      role="toolbar"
      aria-label="Selected notes"
      className="mx-6 mb-3 flex shrink-0 flex-wrap items-center gap-2 rounded-lg border border-white/[0.08] px-3 py-1.5"
    >
      <span role="status" className="text-sm text-foreground tabular-nums">
        {count === 0 ? "Select notes to share" : `${String(count)} selected`}
        {full && (
          <span className="ml-2 text-xs text-amber-400">Limit reached</span>
        )}
      </span>
      <div className="ml-auto flex items-center gap-1">
        {count > 0 && (
          <Button variant="ghost" size="sm" onClick={onClear}>
            Clear
          </Button>
        )}
        <Button variant="ghost" size="sm" onClick={onDone}>
          Done
        </Button>
        <Button size="sm" disabled={count === 0} onClick={onShare}>
          <Share2 />
          Share {count > 0 ? noteCountLabel(count) : "notes"}
        </Button>
      </div>
    </div>
  );
}

function EmptyColumn({ label }: { label: string }) {
  return (
    <div className="flex h-24 items-center justify-center rounded-lg border border-dashed border-white/10 text-xs text-muted-foreground">
      {label}
    </div>
  );
}

function BoardSkeleton() {
  return (
    <div
      aria-hidden
      className="flex min-h-0 flex-1 gap-4 overflow-x-auto px-6 pb-6"
    >
      {BOARD_COLUMNS.map((column) => (
        <div
          key={column}
          className={cn(COLUMN_CLASS, COLUMN_TONES[column].tint)}
        >
          <div className="flex h-7 items-center gap-2 px-1">
            <StatusIcon status={column} />
            <span className="text-sm font-medium text-foreground">
              {BOARD_COLUMN_LABELS[column]}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
