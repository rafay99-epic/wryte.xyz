import type { BoardCard, GroupRow } from "@wryte/backend/cms/notes/_lib/model";
import { getColorClasses } from "@wryte/logic/lib/board-colors";
import { DUE_TONES } from "@wryte/logic/lib/notes/colors";
import { dueLabel, dueTone } from "@wryte/logic/lib/notes/dates";
import { REF_KIND_LABELS, REF_KINDS } from "@wryte/logic/lib/notes/refs";
import { notePath } from "@wryte/logic/lib/notes/views";
import { cn } from "@wryte/logic/lib/utils";
import { KanbanItem } from "@wryte/ui/kanban";
import { CalendarClock, Check, CircleAlert } from "lucide-react";
import { type MouseEvent, memo } from "react";
import { RefKindIcon } from "./ref-kind-icon";

export const NoteCard = memo(function NoteCard({
  card,
  group,
  selected,
  today,
  overlay = false,
  selecting = false,
  checked = false,
  onOpen,
  onToggle,
}: {
  card: BoardCard;
  group: GroupRow | undefined;
  selected: boolean;
  today: string;
  overlay?: boolean;
  selecting?: boolean;
  checked?: boolean;
  onOpen?: (noteId: string) => void;
  onToggle?: (noteId: BoardCard["_id"]) => void;
}) {
  const counts = card.refCounts;
  const refs = counts ? REF_KINDS.filter((kind) => counts[kind] > 0) : [];
  const hasFooter =
    group !== undefined || card.dueDate !== undefined || refs.length > 0;

  function handleClick(event: MouseEvent<HTMLDivElement>) {
    if (!onOpen || event.button !== 0) return;
    if (onToggle && (selecting || event.shiftKey)) {
      event.preventDefault();
      onToggle(card._id);
      return;
    }
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
      return;
    }
    event.preventDefault();
    onOpen(card._id);
  }

  return (
    <KanbanItem
      value={card._id}
      asHandle
      onClick={handleClick}
      aria-current={selected ? "true" : undefined}
      className={cn(
        "relative cursor-pointer touch-manipulation select-none rounded-lg border border-white/[0.07] bg-[#0f0f11] p-3.5 outline-none transition-[background-color,border-color] duration-150 hover:border-white/15 hover:bg-[#131316] focus-visible:border-white/25",
        selected && "ring-1 ring-amber-500/60",
        checked && "border-white/30 bg-[#16161a]",
        overlay
          ? "scale-[1.02] cursor-grabbing border-white/15 bg-[#131316] shadow-2xl shadow-black/70 ring-1 ring-white/15"
          : "data-dragging:border-dashed data-dragging:border-white/15 data-dragging:bg-transparent data-dragging:opacity-100 data-dragging:ring-0 data-dragging:*:invisible",
      )}
    >
      {selecting && !overlay && (
        <button
          type="button"
          role="checkbox"
          aria-checked={checked}
          aria-label={`Select ${card.title || "Untitled"}`}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation();
            onToggle?.(card._id);
          }}
          className={cn(
            "absolute top-3 right-3 flex size-4 items-center justify-center rounded border outline-none focus-visible:ring-2 focus-visible:ring-white/40",
            checked
              ? "border-white bg-white text-black"
              : "border-white/30 bg-transparent",
          )}
        >
          {checked && <Check aria-hidden className="size-3" strokeWidth={3} />}
        </button>
      )}
      <a
        href={notePath(card._id)}
        draggable={false}
        tabIndex={overlay ? -1 : undefined}
        className={cn(
          "line-clamp-2 text-sm leading-5 font-medium outline-none focus-visible:underline",
          selecting && "pr-6",
          !card.title
            ? "text-muted-foreground italic"
            : card.status === "done"
              ? "text-muted-foreground"
              : "text-foreground",
        )}
      >
        {card.title || "Untitled"}
      </a>
      {card.excerpt && (
        <p className="mt-1 line-clamp-2 text-[13px] leading-5 text-muted-foreground">
          {card.excerpt}
        </p>
      )}
      {hasFooter && (
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-muted-foreground">
          {group && (
            <span className="flex min-w-0 items-center gap-1.5">
              <span
                aria-hidden
                className={cn(
                  "size-2 shrink-0 rounded-full",
                  group.color ? getColorClasses(group.color).dot : "bg-border",
                )}
              />
              <span className="max-w-32 truncate">{group.name}</span>
            </span>
          )}
          {card.dueDate && (
            <DueChip dueDate={card.dueDate} card={card} today={today} />
          )}
          {refs.length > 0 && (
            <span className="ml-auto flex items-center gap-2.5">
              {refs.map((kind) => (
                <span
                  key={kind}
                  className="flex items-center gap-1 tabular-nums"
                  title={REF_KIND_LABELS[kind]}
                >
                  <RefKindIcon kind={kind} className="size-3" />
                  {counts?.[kind]}
                  <span className="sr-only">{REF_KIND_LABELS[kind]}</span>
                </span>
              ))}
            </span>
          )}
        </div>
      )}
    </KanbanItem>
  );
});

function DueChip({
  dueDate,
  card,
  today,
}: {
  dueDate: string;
  card: BoardCard;
  today: string;
}) {
  const tone = dueTone(card, today);
  const label = dueLabel(dueDate, today);
  return (
    <span
      className={cn(
        "flex shrink-0 items-center gap-1 tabular-nums",
        DUE_TONES[tone],
      )}
    >
      {tone === "overdue" ? (
        <CircleAlert aria-hidden className="size-3" />
      ) : (
        <CalendarClock aria-hidden className="size-3" />
      )}
      {tone === "overdue"
        ? `Overdue, ${label}`
        : tone === "today"
          ? "Due today"
          : label}
    </span>
  );
}
