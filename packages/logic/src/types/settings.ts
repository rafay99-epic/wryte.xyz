/**
 * Settings page tab routing types.
 *
 * Tabs are declared as `as const` arrays so the TS union of valid IDs
 * is derived rather than hand-maintained. Adding a tab = add one entry.
 */

export const ACCOUNT_SETTINGS_TABS = [
  { id: "account", label: "Account" },
  { id: "appearance", label: "Appearance" },
  { id: "media", label: "Media" },
  { id: "shortcuts", label: "Shortcuts" },
  { id: "danger", label: "Danger zone" },
] as const;

export type AccountSettingsTabId = (typeof ACCOUNT_SETTINGS_TABS)[number]["id"];

export const PROJECT_SETTINGS_TABS = [
  { id: "general", label: "General" },
  { id: "github", label: "GitHub" },
  { id: "content", label: "Content" },
  { id: "media", label: "Media" },
  { id: "publishing", label: "Publishing" },
  { id: "frontmatter", label: "Frontmatter" },
  { id: "ai", label: "AI" },
  { id: "danger", label: "Danger zone" },
] as const;

export type ProjectSettingsTabId = (typeof PROJECT_SETTINGS_TABS)[number]["id"];
