import { getColorClasses } from "@wryte/logic/lib/board-colors";
import { cn } from "@wryte/logic/lib/utils";
import { DEFAULT_BOARD_COLUMNS } from "@wryte/logic/types/board";

type SidebarStatusDotProps = {
  status: string;
};

/**
 * Tiny colored dot rendered next to article rows in the sidebar to
 * indicate their board status. Falls back to a muted grey for unknown
 * statuses that aren't in the default column set.
 */
export function SidebarStatusDot({ status }: SidebarStatusDotProps) {
  const col = DEFAULT_BOARD_COLUMNS.find((c) => c.id === status);
  const dotColor = col
    ? getColorClasses(col.color).dot
    : "bg-muted-foreground/30";
  return (
    <span
      className={cn(
        "size-1.5 rounded-full shrink-0 transition-colors",
        dotColor,
      )}
    />
  );
}
