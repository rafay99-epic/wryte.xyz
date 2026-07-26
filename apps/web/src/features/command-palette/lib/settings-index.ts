/**
 * Settings panes as command-palette entries.
 *
 * Both settings shells already render from a `TABS` array carrying labels,
 * icons, and search keywords — this maps those same arrays into palette rows
 * rather than introducing a second registry to keep in sync. A new settings
 * tab therefore becomes searchable in ⌘K for free.
 *
 * 21 panes is not a database problem: these are matched client-side by the
 * existing fuzzy scorer, so settings search costs nothing and tolerates typos
 * (which server-side full-text search does not).
 */
import { TABS as ACCOUNT_TABS } from "@/features/account-settings/types";
import { TABS as PROJECT_TABS } from "@/features/project-settings/types";

export type SettingsEntry = {
  id: string;
  label: string;
  /** Shown under the label, so "Media" is never ambiguous between the two. */
  group: string;
  /** Invisible haystack for the fuzzy matcher. */
  keywords: string;
  icon: React.ElementType;
  href: string;
};

/** Account-level panes — always reachable. */
export function accountSettingsEntries(): SettingsEntry[] {
  return ACCOUNT_TABS.map((tab) => ({
    id: `setting-account-${tab.id}`,
    label: tab.label,
    group: "Account settings",
    keywords: `settings account preferences ${tab.keywords.join(" ")}`,
    icon: tab.icon,
    href: `/settings#${tab.id}`,
  }));
}

/**
 * Project-level panes. Only meaningful with a project in context, so callers
 * pass the active project — there is no "current project" to guess at from
 * inside the palette.
 */
export function projectSettingsEntries(
  projectId: string,
  projectName: string,
): SettingsEntry[] {
  return PROJECT_TABS.map((tab) => ({
    id: `setting-project-${tab.id}`,
    label: tab.label,
    group: "Project settings",
    keywords: `settings project ${projectName} ${tab.keywords.join(" ")}`,
    icon: tab.icon,
    href: `/projects/${projectId}/settings#${tab.id}`,
  }));
}
