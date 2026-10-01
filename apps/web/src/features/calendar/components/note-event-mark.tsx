import type { NoteEventKind } from "@wryte/logic/lib/calendar-utils";
import { cn } from "@wryte/logic/lib/utils";
import {
  CircleAlert,
  CircleCheck,
  CircleDashed,
  CirclePlus,
} from "lucide-react";

const MARKS: Record<
  NoteEventKind,
  { icon: React.ElementType; className: string }
> = {
  overdue: { icon: CircleAlert, className: "text-red-400" },
  due: { icon: CircleDashed, className: "text-foreground" },
  opened: { icon: CirclePlus, className: "text-sky-400" },
  done: { icon: CircleCheck, className: "text-emerald-400" },
};

export function NoteEventMark({
  kind,
  className,
}: {
  kind: NoteEventKind;
  className?: string;
}) {
  const mark = MARKS[kind];
  const Icon = mark.icon;
  return (
    <Icon
      aria-hidden
      className={cn("size-3 shrink-0", mark.className, className)}
    />
  );
}
