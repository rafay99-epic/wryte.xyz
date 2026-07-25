import type { Id } from "@wryte/backend/_generated/dataModel";
import type { Metadata } from "next";
import Link from "next/link";
import { requireAdminOr404 } from "../../_lib/require-admin";
import { ChangelogEdit } from "./_components/changelog-edit";

export const metadata: Metadata = {
  title: "Edit changelog entry",
};

export default async function EditChangelogPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdminOr404();
  const { id } = await params;

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
          Edit changelog entry
        </h1>
      </div>

      <ChangelogEdit id={id as Id<"changelog">} />
    </div>
  );
}
