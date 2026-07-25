import { Skeleton } from "@wryte/ui/skeleton";

const statKeys = ["total", "drafts", "published", "scheduled"];
const comingSoonKeys = ["analytics", "seo", "calendar", "team"];

export default function DashboardLoading() {
  return (
    <div className="mx-auto max-w-6xl p-6 lg:p-8">
      {/* Welcome */}
      <div className="mb-10 flex items-center gap-3">
        <Skeleton className="size-9 rounded-xl" />
        <div>
          <Skeleton className="h-7 w-56" />
          <Skeleton className="mt-1.5 h-4 w-72" />
        </div>
      </div>

      {/* Stats */}
      <div className="mb-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statKeys.map((key) => (
          <div
            key={key}
            className="rounded-xl border border-border/60 bg-card p-4"
          >
            <div className="flex items-center justify-between">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="size-8 rounded-lg" />
            </div>
            <Skeleton className="mt-3 h-9 w-14" />
            <Skeleton className="mt-3 h-3 w-28" />
          </div>
        ))}
      </div>

      {/* Two-column */}
      <div className="mb-10 grid gap-6 lg:grid-cols-[1fr_320px]">
        {/* Recent docs */}
        <div className="rounded-xl border border-border/60 bg-card">
          <div className="border-b border-border/50 px-4 py-3">
            <Skeleton className="h-5 w-36" />
          </div>
          <div className="divide-y divide-border/30">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3">
                <Skeleton className="size-8 rounded-lg" />
                <div className="flex-1">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="mt-1 h-3 w-20" />
                </div>
                <Skeleton className="h-5 w-14 rounded-full" />
              </div>
            ))}
          </div>
        </div>
        {/* Quick actions */}
        <div className="space-y-4">
          <div className="rounded-xl border border-border/60 bg-card p-4">
            <Skeleton className="mb-2 h-5 w-28" />
            <Skeleton className="mb-3 h-3 w-44" />
            <Skeleton className="mb-2 h-8 w-full rounded-lg" />
            <Skeleton className="h-8 w-full rounded-lg" />
          </div>
        </div>
      </div>

      {/* Coming Soon */}
      <div>
        <Skeleton className="mb-4 h-6 w-36" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {comingSoonKeys.map((key) => (
            <div
              key={key}
              className="rounded-xl border border-dashed border-border/60 bg-card p-4"
            >
              <Skeleton className="mb-3 size-9 rounded-lg" />
              <Skeleton className="mb-2 h-4 w-28" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="mt-1 h-3 w-3/4" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
