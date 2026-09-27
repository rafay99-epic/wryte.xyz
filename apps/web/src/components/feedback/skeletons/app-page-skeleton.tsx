import { PageSkeleton } from "./page-skeleton";

export function AppPageSkeleton({
  className = "mx-auto w-full max-w-6xl lg:p-8",
}: {
  className?: string | undefined;
}) {
  return <PageSkeleton className={className} />;
}
