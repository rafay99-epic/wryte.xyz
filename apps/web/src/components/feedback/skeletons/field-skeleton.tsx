import { cn } from "@wryte/logic/lib/utils";
import { Skeleton } from "@wryte/ui/skeleton";

type FieldSkeletonProps = {
  className?: string;
  withHelp?: boolean;
};

export function FieldSkeleton({
  className,
  withHelp = false,
}: FieldSkeletonProps) {
  return (
    <div className={cn("space-y-2", className)}>
      <Skeleton className="h-3 w-24" />
      <Skeleton className="h-9 w-full" />
      {withHelp ? <Skeleton className="h-3 w-2/3" /> : null}
    </div>
  );
}
