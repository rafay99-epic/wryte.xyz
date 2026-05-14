import { SectionSkeleton } from "@/components/feedback/skeletons/section-skeleton";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type PageSkeletonProps = {
  className?: string;
  /** Number of sections to render. Defaults to 2. */
  sections?: number;
};

/**
 * Generic page-shell skeleton used by routes while their data loads.
 * Renders a page title + breadcrumb + N section skeletons.
 */
export function PageSkeleton({ className, sections = 2 }: PageSkeletonProps) {
  return (
    <div className={cn("space-y-6 p-6", className)}>
      <div className="space-y-2">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-8 w-1/2" />
      </div>
      {Array.from({ length: sections }).map((_, i) => (
        <SectionSkeleton key={i} />
      ))}
    </div>
  );
}
