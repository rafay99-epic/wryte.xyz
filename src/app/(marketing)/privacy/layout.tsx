import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "Privacy policy for Wryte — how we collect, use, and protect your data.",
  alternates: { canonical: "https://wryte.xyz/privacy" },
};

export default function PrivacyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
