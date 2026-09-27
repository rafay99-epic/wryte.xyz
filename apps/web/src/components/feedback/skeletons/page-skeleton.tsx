import { cn } from "@wryte/logic/lib/utils";
import { Skeleton } from "@wryte/ui/skeleton";
import { SectionSkeleton } from "@/components/feedback/skeletons/section-skeleton";

type PageSkeletonProps = {
  className?: string;
  sections?: number;
};

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
