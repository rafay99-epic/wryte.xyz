import type { Metadata } from "next";
import { Suspense, use } from "react";
import { AppPageSkeleton } from "@/components/feedback/skeletons/app-page-skeleton";
import { ProjectDetailPage } from "@/features/project-detail/project-detail-page";

export const metadata: Metadata = {
  title: "Articles",
};

export default function Page({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  return (
    <Suspense fallback={<AppPageSkeleton />}>
      <ProjectArticlesRoute params={params} />
    </Suspense>
  );
}

function ProjectArticlesRoute({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = use(params);
  return <ProjectDetailPage projectId={projectId} />;
}
