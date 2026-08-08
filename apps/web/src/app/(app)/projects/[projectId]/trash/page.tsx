import type { Metadata } from "next";
import { Suspense, use } from "react";
import { AppPageSkeleton } from "@/components/feedback/skeletons/app-page-skeleton";
import { TrashPage } from "@/features/trash/trash-page";

export const metadata: Metadata = {
  title: "Trash",
};

export default function Page({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  return (
    <Suspense fallback={<AppPageSkeleton />}>
      <ProjectTrashRoute params={params} />
    </Suspense>
  );
}

function ProjectTrashRoute({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = use(params);
  return <TrashPage projectId={projectId} />;
}
