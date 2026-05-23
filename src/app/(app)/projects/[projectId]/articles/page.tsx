import type { Metadata } from "next";
import { ProjectDetailPage } from "@/features/project-detail/project-detail-page";

export const metadata: Metadata = {
  title: "Articles",
};

export default function Page() {
  return <ProjectDetailPage />;
}
