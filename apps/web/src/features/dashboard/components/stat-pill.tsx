import { cn } from "@wryte/logic/lib/utils";
import { Skeleton } from "@wryte/ui/skeleton";

export function StatPill({
  value,
  label,
  icon,
  accent,
  loading,
}: {
  value: number;
  label: string;
  icon: React.ReactNode;
  accent?: string | undefined;
  loading: boolean;
}) {
  return (
    <div className="flex shrink-0 items-center gap-2.5">
      <div className={cn("text-muted-foreground/40", accent)}>{icon}</div>
      <div>
        {loading ? (
          <Skeleton className="mb-0.5 h-5 w-6" />
        ) : (
          <span className="text-lg font-bold tabular-nums leading-none tracking-tight">
            {value}
          </span>
        )}
        <span className="block text-[10px] text-muted-foreground/40">
          {label}
        </span>
      </div>
    </div>
  );
}
