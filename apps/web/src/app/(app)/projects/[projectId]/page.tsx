import type { Metadata } from "next";
import { Suspense, use } from "react";
import { AppPageSkeleton } from "@/components/feedback/skeletons/app-page-skeleton";
import { ProjectDashboardPage } from "@/features/project-dashboard/project-dashboard-page";

export const metadata: Metadata = {
  title: "Project",
};

export default function Page({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  return (
    <Suspense fallback={<AppPageSkeleton />}>
      <ProjectDashboardRoute params={params} />
    </Suspense>
  );
}

function ProjectDashboardRoute({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = use(params);
  return <ProjectDashboardPage projectId={projectId} />;
}
