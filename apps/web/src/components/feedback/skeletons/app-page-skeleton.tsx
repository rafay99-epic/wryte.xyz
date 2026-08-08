import { PageSkeleton } from "./page-skeleton";

/** Shared instant-navigation shell for authenticated app pages. */
export function AppPageSkeleton({
  className = "mx-auto w-full max-w-6xl lg:p-8",
}: {
  className?: string | undefined;
}) {
  return <PageSkeleton className={className} />;
}
