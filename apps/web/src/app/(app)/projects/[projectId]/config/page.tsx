import type { Metadata } from "next";
import { Suspense, use } from "react";
import { AppPageSkeleton } from "@/components/feedback/skeletons/app-page-skeleton";
import { ConfigFilesPage } from "@/features/config-files/config-files-page";

export const metadata: Metadata = {
  title: "Config",
};

export default function Page({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  return (
    <Suspense fallback={<AppPageSkeleton />}>
      <ConfigFilesRoute params={params} />
    </Suspense>
  );
}

function ConfigFilesRoute({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = use(params);
  return <ConfigFilesPage projectId={projectId} />;
}
