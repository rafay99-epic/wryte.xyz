import type { Metadata } from "next";
import { NewsletterListPage } from "@/features/newsletter/newsletter-list-page";

export const metadata: Metadata = {
  title: "Newsletters",
};

export default function Page() {
  return <NewsletterListPage />;
}
