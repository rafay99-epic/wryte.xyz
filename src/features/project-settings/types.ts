import {
  Code2,
  FolderTree,
  GitBranch,
  ImageIcon,
  PenLine,
  Rocket,
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
  mediaStorageMode?: MediaStorageMode;
  frontmatterSchema?: string;
  commitMessageTemplate?: string;
  filenamePattern?: string;
  contentFormat?: "md" | "mdx";
  defaultDraft?: boolean;
  siteUrl?: string;
  deployHookUrl?: string;
  frontmatterFormat?: "yaml" | "toml";
  framework?: string;
  defaultAuthor?: string;
  defaultAuthorAvatar?: string;
  aiProvider?: AiProvider;
  aiModel?: string;
  timezone?: string;
  autoSaveEnabled?: boolean;
  compressionSettings?: CompressionSettings;
  maxUploadBytes?: number;
  trashRetentionDays?: number;
  socialPostOnPublish?: boolean;
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
  | "tools";

export const TABS: {
  id: SettingsTab;
  label: string;
  icon: React.ElementType;
}[] = [
  { id: "general", label: "General", icon: Settings2 },
  { id: "github", label: "GitHub", icon: GitBranch },
  { id: "content", label: "Content", icon: FolderTree },
  { id: "media", label: "Media", icon: ImageIcon },
  { id: "publishing", label: "Publishing", icon: Rocket },
  { id: "frontmatter", label: "Frontmatter", icon: Code2 },
  { id: "ai", label: "AI", icon: Sparkles },
  { id: "editor", label: "Editor", icon: PenLine },
  { id: "social", label: "Social", icon: Share2 },
  { id: "tools", label: "Tools", icon: Wrench },
];

export const UPLOAD_POST_PLATFORMS = [
  { id: "x", label: "X (Twitter)" },
  { id: "linkedin", label: "LinkedIn" },
  { id: "bluesky", label: "Bluesky" },
  { id: "threads", label: "Threads" },
  { id: "facebook", label: "Facebook" },
  { id: "reddit", label: "Reddit" },
] as const;

export type VerifyStatus = "idle" | "verifying" | "connected" | "error";

export type AiProviderId = NonNullable<Doc<"projects">["aiProvider"]>;
export type AiSettingsPatch = Pick<Doc<"projects">, "aiProvider" | "aiModel">;
