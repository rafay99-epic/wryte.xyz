import type { Metadata } from "next";
import { Suspense, use } from "react";
import { AppPageSkeleton } from "@/components/feedback/skeletons/app-page-skeleton";
import { CalendarPage } from "@/features/calendar/calendar-page";

export const metadata: Metadata = {
  title: "Calendar",
};

export default function Page({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  return (
    <Suspense fallback={<AppPageSkeleton />}>
      <ProjectCalendarRoute params={params} />
    </Suspense>
  );
}

function ProjectCalendarRoute({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = use(params);
  return <CalendarPage projectId={projectId} />;
}
