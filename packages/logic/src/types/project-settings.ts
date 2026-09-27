import type { Doc } from "@wryte/backend/_generated/dataModel";
import type { AnimationCheckLevel } from "@wryte/backend/_lib/animationChecks";

export type AnimationChecksPolicy = {
  level: AnimationCheckLevel;
  blockPublish: boolean;
};

/** The `projects` row as served to the settings pages. */
export type ProjectData = Doc<"projects">;

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
  | "sharing"
  | "tools";

export type VerifyStatus = "idle" | "verifying" | "connected" | "error";

export type AiProviderId = NonNullable<Doc<"projects">["aiProvider"]>;
export type AiSettingsPatch = Pick<Doc<"projects">, "aiProvider" | "aiModel">;
