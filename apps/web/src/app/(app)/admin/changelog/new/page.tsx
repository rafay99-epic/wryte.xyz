import type { Metadata } from "next";
import Link from "next/link";
import { ChangelogForm } from "../_components/changelog-form";

export const metadata: Metadata = {
  title: "New changelog entry",
};

export default function NewChangelogPage() {
  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <div className="mb-8">
        <Link
          href="/admin/changelog"
          className="text-[12px] font-mono uppercase tracking-wider text-foreground/55 transition-colors hover:text-foreground"
        >
          ← All changelogs
        </Link>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight">
          New changelog entry
        </h1>
        <p className="mt-1 text-sm text-foreground/60">
          Drafts stay hidden until you check Publish.
        </p>
      </div>

      <ChangelogForm />
    </div>
  );
}
