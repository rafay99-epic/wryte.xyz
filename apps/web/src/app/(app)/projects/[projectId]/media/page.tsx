import type { Metadata } from "next";
import { Suspense, use } from "react";
import { AppPageSkeleton } from "@/components/feedback/skeletons/app-page-skeleton";
import { MediaLibraryPage } from "@/features/media-library/media-library-page";

export const metadata: Metadata = {
  title: "Media library",
};

export default function Page({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  return (
    <Suspense fallback={<AppPageSkeleton />}>
      <MediaLibraryRoute params={params} />
    </Suspense>
  );
}

function MediaLibraryRoute({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = use(params);
  return <MediaLibraryPage projectId={projectId} />;
}
