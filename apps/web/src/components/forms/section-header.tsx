import { cn } from "@wryte/logic/lib/utils";
import type { LucideIcon } from "lucide-react";

type SectionHeaderProps = {
  icon?: LucideIcon;
  title: string;
  description?: string;
  className?: string;
};

/**
 * Settings-section header — icon + title + description row that precedes
 * each section card. Both settings pages re-declared this inline.
 */
export function SectionHeader({
  icon: Icon,
  title,
  description,
  className,
}: SectionHeaderProps) {
  return (
    <div className={cn("flex items-start gap-3", className)}>
      {Icon ? (
        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted">
          <Icon className="size-4 text-foreground" />
        </div>
      ) : null}
      <div className="flex-1 min-w-0 space-y-0.5">
        <h2 className="text-base font-semibold leading-tight">{title}</h2>
        {description ? (
          <p className="text-xs text-muted-foreground">{description}</p>
        ) : null}
      </div>
    </div>
  );
}
