import type { BoardColumn } from "@wryte/backend/cms/notes/_lib/model";
import { COLUMN_TONES } from "@wryte/logic/lib/notes/colors";
import { cn } from "@wryte/logic/lib/utils";
import {
  Circle,
  CircleCheck,
  CircleDot,
  FileText,
  type LucideIcon,
} from "lucide-react";

const ICONS: Record<BoardColumn, LucideIcon> = {
  notes: FileText,
  todo: Circle,
  doing: CircleDot,
  done: CircleCheck,
};

export function StatusIcon({
  status,
  className,
}: {
  status: BoardColumn;
  className?: string;
}) {
  const Icon = ICONS[status];
  return (
    <Icon
      aria-hidden
      className={cn("size-3.5", COLUMN_TONES[status].icon, className)}
    />
  );
}
