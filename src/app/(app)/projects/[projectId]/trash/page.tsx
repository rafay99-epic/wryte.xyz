import type { Metadata } from "next";
import { TrashPage } from "@/features/trash/trash-page";

export const metadata: Metadata = {
  title: "Trash — Wryte",
};

export default function Page() {
  return <TrashPage />;
}
