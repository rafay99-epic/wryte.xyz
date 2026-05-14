import type { Metadata } from "next";
import { ProjectsListPage } from "@/features/projects-list/projects-list-page";

export const metadata: Metadata = {
  title: "Projects — Wryte",
};

export default function Page() {
  return <ProjectsListPage />;
}
