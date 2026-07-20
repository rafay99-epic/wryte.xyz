import type { Metadata } from "next";
import { NewsletterComposer } from "@/features/newsletter/newsletter-composer";

export const metadata: Metadata = {
  title: "Compose newsletter",
};

export default function Page() {
  return <NewsletterComposer />;
}
