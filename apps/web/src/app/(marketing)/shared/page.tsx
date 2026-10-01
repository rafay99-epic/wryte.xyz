import type { Metadata } from "next";
import { SharedNotesPage } from "@/features/shared-notes/shared-notes-page";

export const metadata: Metadata = {
  title: "Shared notes",
  robots: { index: false, follow: false },
};

export default function Page() {
  return <SharedNotesPage />;
}
