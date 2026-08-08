import { AppPageSkeleton } from "@/components/feedback/skeletons/app-page-skeleton";

/**
 * Shared authenticated-route shell. Next 16.3 can prefetch this once per
 * route pattern and reveal it immediately while the destination streams.
 */
export default function AppLoading() {
  return <AppPageSkeleton />;
}
