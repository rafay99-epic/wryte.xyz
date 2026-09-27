import type { SettingsTab } from "@wryte/logic/types/account-settings";
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

export const TABS: {
  id: SettingsTab;
  label: string;
  icon: React.ElementType;
  keywords: string[];
}[] = [
  {
    id: "account",
    label: "Account",
    icon: User,
    keywords: [
      "email",
      "github",
      "token",
      "pat",
      "personal access token",
      "connection",
      "sign out",
    ],
  },
  {
    id: "profile",
    label: "Profile",
    icon: Globe,
    keywords: [
      "public page",
      "handle",
      "username",
      "bio",
      "avatar",
      "social links",
      "website",
    ],
  },
  {
    id: "appearance",
    label: "Appearance",
    icon: Palette,
    keywords: ["theme", "dark", "light", "font", "accent", "color", "colour"],
  },
  {
    id: "media",
    label: "Media",
    icon: ImageIcon,
    keywords: [
      "uploadthing",
      "cloudinary",
      "storage",
      "quota",
      "upload limit",
      "images",
    ],
  },
  {
    id: "mcp",
    label: "MCP Server",
    icon: Plug,
    keywords: [
      "agent",
      "claude",
      "cursor",
      "oauth",
      "endpoint",
      "tools",
      "model context protocol",
    ],
  },
  {
    id: "shortcuts",
    label: "Shortcuts",
    icon: Command,
    keywords: ["keybinding", "hotkey", "keys", "remap", "keyboard"],
  },
  {
    id: "support",
    label: "Support",
    icon: HelpCircle,
    keywords: ["ticket", "help", "contact", "bug report", "feedback"],
  },
  {
    id: "self-destruct",
    label: "Self-Destruct",
    icon: Skull,
    keywords: ["delete account", "wipe", "erase", "gdpr", "danger", "close"],
  },
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
