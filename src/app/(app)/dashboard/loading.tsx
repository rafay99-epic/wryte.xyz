import { Skeleton } from "@/components/ui/skeleton";

const statKeys = ["total", "drafts", "published", "scheduled"];
const comingSoonKeys = ["analytics", "seo", "calendar", "team"];

export default function DashboardLoading() {
  return (
    <div className="p-6">
      {/* Welcome */}
      <div className="mb-8">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="mt-2 h-5 w-80" />
      </div>

      {/* Stats */}
      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statKeys.map((key) => (
          <div key={key} className="rounded-xl border p-4">
            <div className="flex items-center justify-between">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="size-4" />
            </div>
            <Skeleton className="mt-3 h-8 w-12" />
            <Skeleton className="mt-3 h-3 w-28" />
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="mb-8">
        <Skeleton className="mb-4 h-6 w-32" />
        <div className="flex gap-3">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-8 w-36" />
        </div>
      </div>

      {/* Coming Soon */}
      <div>
        <Skeleton className="mb-4 h-6 w-32" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {comingSoonKeys.map((key) => (
            <div key={key} className="rounded-xl border p-4">
              <Skeleton className="mb-3 size-10" />
              <Skeleton className="mb-2 h-5 w-28" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="mt-1 h-4 w-3/4" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
