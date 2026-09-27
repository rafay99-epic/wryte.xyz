import type { SettingsTab } from "@wryte/logic/types/project-settings";
import {
  Code2,
  FolderTree,
  GitBranch,
  ImageIcon,
  Link2,
  PenLine,
  Rocket,
  Rss,
  Settings2,
  Share2,
  Sparkles,
  Wrench,
} from "lucide-react";

export const TABS: {
  id: SettingsTab;
  label: string;
  icon: React.ElementType;
  keywords: string[];
}[] = [
  {
    id: "general",
    label: "General",
    icon: Settings2,
    keywords: ["name", "site url", "author", "avatar", "delete", "danger"],
  },
  {
    id: "github",
    label: "GitHub",
    icon: GitBranch,
    keywords: ["repository", "repo", "branch", "token", "pat", "oauth"],
  },
  {
    id: "content",
    label: "Content",
    icon: FolderTree,
    keywords: ["directory", "path", "format", "mdx", "markdown", "filename"],
  },
  {
    id: "media",
    label: "Media",
    icon: ImageIcon,
    keywords: [
      "storage",
      "uploadthing",
      "cloudinary",
      "compression",
      "watermark",
      "upload size",
      "images",
    ],
  },
  {
    id: "publishing",
    label: "Publishing",
    icon: Rocket,
    keywords: [
      "commit",
      "attribution",
      "badge",
      "verified",
      "draft",
      "autosave",
      "timezone",
      "trash",
      "deployment",
      "vercel",
    ],
  },
  {
    id: "frontmatter",
    label: "Frontmatter",
    icon: Code2,
    keywords: ["schema", "fields", "yaml", "json", "tags", "description"],
  },
  {
    id: "ai",
    label: "AI",
    icon: Sparkles,
    keywords: [
      "provider",
      "model",
      "api key",
      "anthropic",
      "openai",
      "openrouter",
      "gemini",
      "groq",
      "prompt",
    ],
  },
  {
    id: "editor",
    label: "Editor",
    icon: PenLine,
    keywords: [
      "readability",
      "slash",
      "snippets",
      "toolbar",
      "selection",
      "lens",
    ],
  },
  {
    id: "social",
    label: "Social",
    icon: Share2,
    keywords: ["buffer", "channels", "post", "announce", "url prefix"],
  },
  {
    id: "syndication",
    label: "Syndication",
    icon: Rss,
    keywords: [
      "dev.to",
      "devto",
      "hashnode",
      "cross-post",
      "crosspost",
      "canonical",
      "syndicate",
      "mirror",
    ],
  },
  {
    id: "sharing",
    label: "Share links",
    icon: Link2,
    keywords: [
      "share",
      "preview",
      "public link",
      "revoke",
      "delete",
      "token",
      "visibility",
    ],
  },
  {
    id: "tools",
    label: "Tools",
    icon: Wrench,
    keywords: ["export", "backup", "links", "check", "zip"],
  },
];
