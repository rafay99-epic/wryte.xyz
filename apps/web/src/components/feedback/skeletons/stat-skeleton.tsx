import { cn } from "@wryte/logic/lib/utils";
import { Skeleton } from "@wryte/ui/skeleton";

type StatSkeletonProps = {
  className?: string;
};

/**
 * Dashboard/inventory stat tile skeleton — label on top, big number below.
 * Used for "X projects", "Y documents", etc.
 */
export function StatSkeleton({ className }: StatSkeletonProps) {
  return (
    <div
      className={cn(
        "rounded-xl border border-border/40 bg-card p-4 space-y-2",
        className,
      )}
    >
      <Skeleton className="h-3 w-20" />
      <Skeleton className="h-8 w-16" />
    </div>
  );
}
