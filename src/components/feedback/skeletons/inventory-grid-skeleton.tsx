import { StatSkeleton } from "@/components/feedback/skeletons/stat-skeleton";
import { cn } from "@/lib/utils";

type InventoryGridSkeletonProps = {
  className?: string;
  /** Number of stat tiles to show. Defaults to 3 (matches both settings pages). */
  count?: number;
};

/**
 * Three-column inventory grid skeleton used by the self-destruct preview
 * (account settings) and the project danger zone. Both pages previously
 * inlined an identical 3-column Skeleton layout.
 */
export function InventoryGridSkeleton({
  className,
  count = 3,
}: InventoryGridSkeletonProps) {
  return (
    <div className={cn("grid grid-cols-1 gap-3 sm:grid-cols-3", className)}>
      {Array.from({ length: count }).map((_, i) => (
        <StatSkeleton key={i} />
      ))}
    </div>
  );
}
