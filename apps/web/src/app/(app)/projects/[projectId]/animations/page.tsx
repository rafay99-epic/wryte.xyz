import type { Metadata } from "next";
import { AnimationGalleryPage } from "@/features/animation-gallery/animation-gallery-page";

export const metadata: Metadata = {
  title: "Animations",
};

export default function Page() {
  return <AnimationGalleryPage />;
}
