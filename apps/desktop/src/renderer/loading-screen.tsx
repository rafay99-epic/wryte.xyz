import { Skeleton } from "@wryte/ui/skeleton";

/** Full-window loading state shown while route chunks resolve. */
export function LoadingScreen() {
  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background">
      <div className="flex h-12 items-center border-b border-border/50 px-3">
        <Skeleton className="h-5 w-40" />
      </div>
      <div className="flex-1 p-6">
        <Skeleton className="mb-4 h-8 w-64" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Skeleton className="h-28 w-full rounded-xl" />
          <Skeleton className="h-28 w-full rounded-xl" />
          <Skeleton className="h-28 w-full rounded-xl" />
          <Skeleton className="h-28 w-full rounded-xl" />
        </div>
      </div>
    </div>
  );
}
