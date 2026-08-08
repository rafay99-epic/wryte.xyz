import type { Metadata } from "next";
import { Suspense, use } from "react";
import { AppPageSkeleton } from "@/components/feedback/skeletons/app-page-skeleton";
import { EditorPage } from "@/features/editor/editor-page";

export const metadata: Metadata = {
  title: "Editor",
};

export default function Page({
  params,
}: {
  params: Promise<{ documentId: string }>;
}) {
  return (
    <Suspense fallback={<AppPageSkeleton className="h-full w-full" />}>
      <EditorRoute params={params} />
    </Suspense>
  );
}

function EditorRoute({ params }: { params: Promise<{ documentId: string }> }) {
  const { documentId } = use(params);
  return <EditorPage documentId={documentId} />;
}
