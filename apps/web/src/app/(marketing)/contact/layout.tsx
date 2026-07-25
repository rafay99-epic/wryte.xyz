import { absoluteUrl } from "@wryte/logic/lib/seo";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Contact Us",
  description:
    "Get in touch with the Wryte team — report a bug, request a feature, or ask a question.",
  alternates: { canonical: absoluteUrl("/contact") },
};

export default function ContactLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
