import type { Metadata } from "next";
import { Suspense, use } from "react";
import { PreviewLoading, PreviewPage } from "./preview-page";

export const metadata: Metadata = {
  title: "Draft preview",
  robots: { index: false, follow: false },
};

export default function Page({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  return (
    <Suspense fallback={<PreviewLoading />}>
      <PreviewRoute params={params} />
    </Suspense>
  );
}

function PreviewRoute({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  return <PreviewPage token={token} />;
}
