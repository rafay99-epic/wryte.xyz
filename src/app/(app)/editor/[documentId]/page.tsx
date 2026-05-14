import type { Metadata } from "next";
import { EditorPage } from "@/features/editor/editor-page";

export const metadata: Metadata = {
  title: "Editor — Wryte",
};

export default function Page() {
  return <EditorPage />;
}
