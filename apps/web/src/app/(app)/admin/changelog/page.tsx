import type { Metadata } from "next";
import { ChangelogListAdmin } from "./_components/changelog-list-admin";

export const metadata: Metadata = {
  title: "All changelogs",
};

/**
 * Admin list view — every changelog entry, drafts included. Click an
 * entry to edit; the "Add new" button routes to
 * `/admin/changelog/new`.
 */
export default function ChangelogListPage() {
  return <ChangelogListAdmin />;
}
