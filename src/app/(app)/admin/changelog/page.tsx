import type { Metadata } from "next";
import { requireAdminOr404 } from "../_lib/require-admin";
import { ChangelogListAdmin } from "./_components/changelog-list-admin";

export const metadata: Metadata = {
  title: "All changelogs",
};

/**
 * Admin list view — every changelog entry, drafts included. Click an
 * entry to edit; the "Add new" button routes to
 * `/admin/changelog/new`.
 */
export default async function ChangelogListPage() {
  await requireAdminOr404();
  return <ChangelogListAdmin />;
}
