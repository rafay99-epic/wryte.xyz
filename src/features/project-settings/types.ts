import {
  BarChart3,
  Code2,
  FolderTree,
  GitBranch,
  ImageIcon,
  PenLine,
  Rocket,
  Rss,
  Settings2,
  Share2,
  Sparkles,
  Wrench,
} from "lucide-react";
import type { CompressionSettings } from "@/lib/image-compression";
import type { AiProvider } from "@/types/ai";
import type {
  FrontmatterField,
  FrontmatterFieldType,
} from "@/types/frontmatter";
import type { MediaStorageMode } from "@/types/media";
import type { Doc } from "../../../convex/_generated/dataModel";

export type {
  AiProvider,
  CompressionSettings,
  FrontmatterField,
  FrontmatterFieldType,
  MediaStorageMode,
};

export type ProjectData = {
  name: string;
  slug: string;
  githubRepo?: string;
  githubBranch?: string;
  contentPath?: string;
  mediaPath?: string;
  animationsPath?: string;
  animationsEnabled?: boolean;
  mediaStorageMode?: MediaStorageMode;
  frontmatterSchema?: string;
  commitMessageTemplate?: string;
  commitAttribution?: boolean;
  commitAttributionText?: string;
  verifiedCommits?: boolean;
  filenamePattern?: string;
  contentFormat?: "md" | "mdx";
  defaultDraft?: boolean;
  siteUrl?: string;
  postUrlPrefix?: string;
  deployHookUrl?: string;
  frontmatterFormat?: "yaml" | "toml";
  framework?: string;
  defaultAuthor?: string;
  defaultAuthorAvatar?: string;
  aiProvider?: AiProvider;
  aiModel?: string;
  timezone?: string;
  autoSaveEnabled?: boolean;
  autoWatermarkRemoval?: boolean;
  compressionSettings?: CompressionSettings;
  maxUploadBytes?: number;
  trashRetentionDays?: number;
  socialPostOnPublish?: boolean;
  syndicateOnPublish?: boolean;
  deployVerificationEnabled?: boolean;
  readabilityLensEnabled?: boolean;
  slashCommandsEnabled?: boolean;
  snippetsEnabled?: boolean;
  selectionToolbarEnabled?: boolean;
  snippetCount?: number;
};

export const DEFAULT_FIELDS: FrontmatterField[] = [
  {
    name: "title",
    type: "string",
    required: true,
    defaultValue: "",
    options: "",
  },
  {
    name: "description",
    type: "text",
    required: false,
    defaultValue: "",
    options: "",
  },
  { name: "date", type: "date", required: true, defaultValue: "", options: "" },
  {
    name: "tags",
    type: "tags",
    required: false,
    defaultValue: "",
    options: "",
  },
  {
    name: "draft",
    type: "boolean",
    required: false,
    defaultValue: "true",
    options: "",
  },
];

export type SettingsTab =
  | "general"
  | "github"
  | "content"
  | "publishing"
  | "frontmatter"
  | "media"
  | "ai"
  | "editor"
  | "social"
  | "syndication"
  | "analytics"
  | "tools";

export const TABS: {
  id: SettingsTab;
  label: string;
  icon: React.ElementType;
  /** Search terms for the settings filter beyond the label. */
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
    id: "analytics",
    label: "Analytics",
    icon: BarChart3,
    keywords: [
      "plausible",
      "umami",
      "views",
      "pageviews",
      "visitors",
      "stats",
      "traffic",
    ],
  },
  {
    id: "tools",
    label: "Tools",
    icon: Wrench,
    keywords: ["export", "backup", "links", "check", "zip"],
  },
];

export { bufferServiceLabel } from "@/lib/social-template";

export type VerifyStatus = "idle" | "verifying" | "connected" | "error";

export type AiProviderId = NonNullable<Doc<"projects">["aiProvider"]>;
export type AiSettingsPatch = Pick<Doc<"projects">, "aiProvider" | "aiModel">;
