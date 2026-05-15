import type { Metadata } from "next";
import { NewArticlePage } from "@/features/new-article/new-article-page";

export const metadata: Metadata = {
  title: "New article",
};

export default function Page() {
  return <NewArticlePage />;
}
