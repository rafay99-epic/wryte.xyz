import type { Metadata } from "next";
import { Suspense, use } from "react";
import { AppPageSkeleton } from "@/components/feedback/skeletons/app-page-skeleton";
import { AnimationGalleryPage } from "@/features/animation-gallery/animation-gallery-page";

export const metadata: Metadata = {
  title: "Animations",
};

export default function Page({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  return (
    <Suspense fallback={<AppPageSkeleton />}>
      <AnimationGalleryRoute params={params} />
    </Suspense>
  );
}

function AnimationGalleryRoute({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = use(params);
  return <AnimationGalleryPage projectId={projectId} />;
}
