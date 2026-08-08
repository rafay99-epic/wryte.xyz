import type { Metadata } from "next";
import { Suspense, use } from "react";
import { AppPageSkeleton } from "@/components/feedback/skeletons/app-page-skeleton";
import { ProjectSettingsPage } from "@/features/project-settings/project-settings-page";

export const metadata: Metadata = {
  title: "Project settings",
};

export default function Page({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  return (
    <Suspense fallback={<AppPageSkeleton />}>
      <ProjectSettingsRoute params={params} />
    </Suspense>
  );
}

function ProjectSettingsRoute({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = use(params);
  return <ProjectSettingsPage projectId={projectId} />;
}
