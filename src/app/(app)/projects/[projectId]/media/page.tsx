import type { Metadata } from "next";
import { MediaLibraryPage } from "@/features/media-library/media-library-page";

export const metadata: Metadata = {
  title: "Media library — Wryte",
};

export default function Page() {
  return <MediaLibraryPage />;
}
