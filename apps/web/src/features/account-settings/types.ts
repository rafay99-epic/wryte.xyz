import type { ShortcutCategory } from "@wryte/logic/stores/shortcuts-store";
import {
  CheckCircle2,
  Clock,
  Command,
  Globe,
  HelpCircle,
  ImageIcon,
  MessageSquare,
  Palette,
  Plug,
  Skull,
  User,
  XCircle,
} from "lucide-react";

export type SettingsTab =
  | "account"
  | "profile"
  | "appearance"
  | "media"
  | "mcp"
  | "shortcuts"
  | "support"
  | "self-destruct";

export const TABS: {
  id: SettingsTab;
  label: string;
  icon: React.ElementType;
}[] = [
  { id: "account", label: "Account", icon: User },
  { id: "profile", label: "Profile", icon: Globe },
  { id: "appearance", label: "Appearance", icon: Palette },
  { id: "media", label: "Media", icon: ImageIcon },
  { id: "mcp", label: "MCP Server", icon: Plug },
  { id: "shortcuts", label: "Shortcuts", icon: Command },
  { id: "support", label: "Support", icon: HelpCircle },
  { id: "self-destruct", label: "Self-Destruct", icon: Skull },
];

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

export const STATUS_STYLES: Record<
  string,
  { label: string; className: string; icon: React.ElementType }
> = {
  open: {
    label: "Open",
    className:
      "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800",
    icon: MessageSquare,
  },
  in_progress: {
    label: "In Progress",
    className:
      "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800",
    icon: Clock,
  },
  resolved: {
    label: "Resolved",
    className:
      "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800",
    icon: CheckCircle2,
  },
  closed: {
    label: "Closed",
    className: "bg-foreground/5 text-muted-foreground border-border",
    icon: XCircle,
  },
};
