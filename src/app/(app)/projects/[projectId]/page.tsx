import type { Metadata } from "next";
import { ProjectDetailPage } from "@/features/project-detail/project-detail-page";

export const metadata: Metadata = {
  title: "Project",
};

export default function Page() {
  return <ProjectDetailPage />;
}
