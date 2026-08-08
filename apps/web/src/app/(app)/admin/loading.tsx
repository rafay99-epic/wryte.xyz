import { AppPageSkeleton } from "@/components/feedback/skeletons/app-page-skeleton";

/** Static shell shown immediately while the request-scoped admin gate runs. */
export default function AdminLoading() {
  return <AppPageSkeleton className="mx-auto w-full max-w-4xl px-6 py-10" />;
}
