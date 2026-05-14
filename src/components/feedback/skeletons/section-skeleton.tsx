import { FieldSkeleton } from "@/components/feedback/skeletons/field-skeleton";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type SectionSkeletonProps = {
  className?: string;
  /** Number of placeholder fields to render. */
  fields?: number;
  /** Whether to render a section title above the fields. */
  withTitle?: boolean;
};

/**
 * Settings-section skeleton — title + N fields. Mirrors the shape used by
 * every settings tab so a single primitive covers them all.
 */
export function SectionSkeleton({
  className,
  fields = 4,
  withTitle = true,
}: SectionSkeletonProps) {
  return (
    <div className={cn("space-y-4", className)}>
      {withTitle ? (
        <div className="space-y-2">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-3 w-2/3" />
        </div>
      ) : null}
      <div className="space-y-3 rounded-xl border border-border/40 bg-card p-4">
        {Array.from({ length: fields }).map((_, i) => (
          <FieldSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}
