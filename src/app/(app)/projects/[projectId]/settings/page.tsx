import type { Metadata } from "next";
import { ProjectSettingsPage } from "@/features/project-settings/project-settings-page";

export const metadata: Metadata = {
  title: "Project settings — Wryte",
};

export default function Page() {
  return <ProjectSettingsPage />;
}
