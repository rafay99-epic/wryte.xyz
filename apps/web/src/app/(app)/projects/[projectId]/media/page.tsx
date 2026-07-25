import type { Metadata } from "next";
import { MediaLibraryPage } from "@/features/media-library/media-library-page";

export const metadata: Metadata = {
  title: "Media library",
};

export default function Page() {
  return <MediaLibraryPage />;
}
