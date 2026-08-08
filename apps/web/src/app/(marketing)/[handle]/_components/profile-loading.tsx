import { Skeleton } from "@wryte/ui/skeleton";

/** Reusable static shell for instant profile-route navigations. */
export function ProfileLoading() {
  return (
    <main className="mx-auto min-h-screen w-full max-w-4xl px-6 py-16 sm:py-24">
      <div className="flex flex-col items-center text-center">
        <Skeleton className="size-24 rounded-full" />
        <Skeleton className="mt-6 h-8 w-56" />
        <Skeleton className="mt-3 h-4 w-32" />
        <Skeleton className="mt-6 h-4 w-full max-w-lg" />
        <Skeleton className="mt-2 h-4 w-4/5 max-w-md" />
      </div>
      <div className="mt-14 grid gap-4 sm:grid-cols-3">
        {["published", "streak", "words"].map((key) => (
          <div
            key={key}
            className="rounded-xl border border-border/50 bg-card p-5"
          >
            <Skeleton className="h-8 w-16" />
            <Skeleton className="mt-2 h-3 w-24" />
          </div>
        ))}
      </div>
      <div className="mt-12 space-y-4">
        <Skeleton className="h-6 w-40" />
        {["first", "second", "third"].map((key) => (
          <Skeleton key={key} className="h-24 w-full rounded-xl" />
        ))}
      </div>
    </main>
  );
}
