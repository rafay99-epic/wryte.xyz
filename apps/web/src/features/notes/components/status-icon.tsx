import type { NoteStatus } from "@wryte/backend/cms/notes/_lib/model";
import { cn } from "@wryte/logic/lib/utils";
import { Circle, CircleCheck, CircleDot, type LucideIcon } from "lucide-react";

const ICONS: Record<NoteStatus, LucideIcon> = {
  todo: Circle,
  doing: CircleDot,
  done: CircleCheck,
};

const TONES: Record<NoteStatus, string> = {
  todo: "text-muted-foreground",
  doing: "text-amber-400",
  done: "text-emerald-400",
};

export function StatusIcon({
  status,
  className,
}: {
  status: NoteStatus;
  className?: string;
}) {
  const Icon = ICONS[status];
  return (
    <Icon aria-hidden className={cn("size-3.5", TONES[status], className)} />
  );
}
