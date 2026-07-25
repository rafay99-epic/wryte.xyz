import { absoluteUrl } from "@wryte/logic/lib/seo";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "How It Works",
  description:
    "See how Wryte takes you from idea to published content — write, organize, and ship to GitHub in minutes.",
  alternates: { canonical: absoluteUrl("/how-it-works") },
};

export default function HowItWorksLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
