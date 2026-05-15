import type { Metadata } from "next";
import { NewProjectPage } from "@/features/new-project/new-project-page";

export const metadata: Metadata = {
  title: "New project",
};

export default function Page() {
  return <NewProjectPage />;
}
