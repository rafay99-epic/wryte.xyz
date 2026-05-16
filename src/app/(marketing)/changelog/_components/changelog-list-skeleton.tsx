/**
 * Static skeleton shown while the Convex query resolves inside the PPR
 * Suspense boundary. Mirrors the layout of `ChangelogList` so there is
 * no layout shift when the real content streams in.
 */
export function ChangelogListSkeleton() {
  return (
    <ol className="relative space-y-20 border-l border-foreground/10 pl-8">
      {[0, 1, 2].map((i) => (
        <li key={i} className="relative">
          <span className="absolute -left-[34px] top-2 size-3 rounded-full border-2 border-background bg-foreground/20" />
          <div className="mb-3 flex flex-wrap items-center gap-3">
            <div className="h-3 w-28 animate-pulse rounded-full bg-foreground/10" />
            <div className="h-4 w-14 animate-pulse rounded-full bg-foreground/10" />
            <div className="h-3 w-20 animate-pulse rounded-full bg-foreground/10" />
          </div>
          <div className="h-7 w-3/5 animate-pulse rounded-md bg-foreground/10" />
          <div className="mt-3 h-4 w-4/5 animate-pulse rounded-md bg-foreground/10" />
          <div className="mt-6 space-y-2.5">
            <div className="h-3 w-full animate-pulse rounded-md bg-foreground/10" />
            <div className="h-3 w-[92%] animate-pulse rounded-md bg-foreground/10" />
            <div className="h-3 w-[75%] animate-pulse rounded-md bg-foreground/10" />
          </div>
        </li>
      ))}
    </ol>
  );
}
