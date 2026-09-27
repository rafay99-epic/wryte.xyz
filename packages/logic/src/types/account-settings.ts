import type { ShortcutCategory } from "@wryte/logic/stores/shortcuts-store";

export type SettingsTab =
  | "account"
  | "profile"
  | "appearance"
  | "media"
  | "mcp"
  | "shortcuts"
  | "support"
  | "self-destruct";

export const CATEGORY_LABELS: Record<ShortcutCategory, string> = {
  general: "General",
  navigation: "Navigation",
  editor: "Editor",
};

export const CATEGORY_ORDER: ShortcutCategory[] = [
  "general",
  "navigation",
  "editor",
];
