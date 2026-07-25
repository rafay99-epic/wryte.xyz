import { cn } from "@wryte/logic/lib/utils";
import { Skeleton } from "@wryte/ui/skeleton";

type FieldSkeletonProps = {
  className?: string;
  /** Show a help/description line below the input. */
  withHelp?: boolean;
};

/**
 * Form field skeleton — label + input shape. Used inside settings cards
 * where each row is a labelled control.
 */
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
