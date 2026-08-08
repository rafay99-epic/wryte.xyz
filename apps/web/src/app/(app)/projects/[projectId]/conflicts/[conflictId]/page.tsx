import type { Metadata } from "next";
import { Suspense, use } from "react";
import { AppPageSkeleton } from "@/components/feedback/skeletons/app-page-skeleton";
import { ConflictPage } from "@/features/sync-conflicts/conflict-page";

export const metadata: Metadata = {
  title: "Sync conflict",
};

export default function Page({
  params,
}: {
  params: Promise<{ projectId: string; conflictId: string }>;
}) {
  return (
    <Suspense fallback={<AppPageSkeleton />}>
      <ConflictRoute params={params} />
    </Suspense>
  );
}

function ConflictRoute({
  params,
}: {
  params: Promise<{ projectId: string; conflictId: string }>;
}) {
  const { projectId, conflictId } = use(params);
  return <ConflictPage conflictId={conflictId} projectId={projectId} />;
}
