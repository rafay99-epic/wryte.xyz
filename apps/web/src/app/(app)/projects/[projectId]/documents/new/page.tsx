import type { Metadata } from "next";
import { Suspense, use } from "react";
import { AppPageSkeleton } from "@/components/feedback/skeletons/app-page-skeleton";
import { NewProjectDocumentPage } from "@/features/new-project-document/new-project-document-page";

export const metadata: Metadata = {
  title: "New document",
};

export default function Page({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  return (
    <Suspense fallback={<AppPageSkeleton />}>
      <NewProjectDocumentRoute params={params} />
    </Suspense>
  );
}

function NewProjectDocumentRoute({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = use(params);
  return <NewProjectDocumentPage projectId={projectId} />;
}
