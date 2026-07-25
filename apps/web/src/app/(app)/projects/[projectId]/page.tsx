import type { Metadata } from "next";
import { ProjectDashboardPage } from "@/features/project-dashboard/project-dashboard-page";

export const metadata: Metadata = {
  title: "Project",
};

export default function Page() {
  return <ProjectDashboardPage />;
}
