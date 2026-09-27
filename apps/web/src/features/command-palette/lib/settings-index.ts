import { TABS as ACCOUNT_TABS } from "@/features/account-settings/constants";
import { TABS as PROJECT_TABS } from "@/features/project-settings/tabs";

export type SettingsEntry = {
  id: string;
  label: string;
  group: string;
  keywords: string;
  icon: React.ElementType;
  href: string;
};

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
