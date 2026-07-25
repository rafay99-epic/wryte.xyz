import type { Metadata } from "next";
import { ProjectAnalyticsPage } from "@/features/project-analytics/analytics-page";

export const metadata: Metadata = {
  title: "Analytics",
};

export default function Page() {
  return <ProjectAnalyticsPage />;
}
