import type { Metadata } from "next";
import { NewProjectDocumentPage } from "@/features/new-project-document/new-project-document-page";

export const metadata: Metadata = {
  title: "New document — Wryte",
};

export default function Page() {
  return <NewProjectDocumentPage />;
}
