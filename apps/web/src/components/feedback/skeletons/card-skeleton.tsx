import { cn } from "@wryte/logic/lib/utils";
import { Skeleton } from "@wryte/ui/skeleton";

type CardSkeletonProps = {
  className?: string;
  /** Show a header line above the body. */
  withHeader?: boolean;
  /** Number of body lines to render. */
  lines?: number;
};

/**
 * Generic card-shaped skeleton. Mirrors the `rounded-xl border bg-card p-4`
 * shape used throughout the app's setting cards and content cards.
 */
export function CardSkeleton({
  className,
  withHeader = true,
  lines = 3,
}: CardSkeletonProps) {
  return (
    <div
      className={cn(
        "rounded-xl border border-border/40 bg-card p-4 space-y-3",
        className,
      )}
    >
      {withHeader ? <Skeleton className="h-5 w-1/3" /> : null}
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className={cn("h-4", i === lines - 1 ? "w-2/3" : "w-full")}
        />
      ))}
    </div>
  );
}
