import type { Metadata } from "next";
import { PreviewPage } from "./preview-page";

// Share links are unlisted by design — keep crawlers away from them.
export const metadata: Metadata = {
  title: "Draft preview · Wryte",
  robots: { index: false, follow: false },
};

export default function Page() {
  return <PreviewPage />;
}
