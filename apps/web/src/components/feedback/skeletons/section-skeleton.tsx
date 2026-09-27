import { cn } from "@wryte/logic/lib/utils";
import { Skeleton } from "@wryte/ui/skeleton";
import { FieldSkeleton } from "@/components/feedback/skeletons/field-skeleton";

type SectionSkeletonProps = {
  className?: string;
  fields?: number;
  withTitle?: boolean;
};

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
