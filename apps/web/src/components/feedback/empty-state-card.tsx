import { cn } from "@wryte/logic/lib/utils";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

type EmptyStateCardProps = {
  /** Icon shown at the top of the card. */
  icon?: LucideIcon;
  /** Big bold line. */
  title: string;
  /** Smaller muted-foreground paragraph below. Optional. */
  description?: string;
  /** Action row at the bottom (e.g. a Button). Optional. */
  action?: ReactNode;
  className?: string;
};

/**
 * Generic "nothing here yet" placeholder. Used wherever a list, grid, or
 * panel is empty — replaces dozens of ad-hoc empty-state markup blocks.
 */
export function EmptyStateCard({
  icon: Icon,
  title,
  description,
  action,
  className,
}: EmptyStateCardProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-xl border border-dashed border-border/40 bg-card/50 px-6 py-10 text-center",
        className,
      )}
    >
      {Icon ? (
        <div className="mb-3 flex size-10 items-center justify-center rounded-xl bg-muted">
          <Icon className="size-5 text-muted-foreground" />
        </div>
      ) : null}
      <p className="text-sm font-medium">{title}</p>
      {description ? (
        <p className="mt-1 max-w-sm text-xs text-muted-foreground">
          {description}
        </p>
      ) : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
