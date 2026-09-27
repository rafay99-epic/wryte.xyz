import type { FrontmatterFieldType } from "@wryte/logic/types/frontmatter";

export type DetectionFramework =
  | "astro"
  | "nextjs"
  | "hugo"
  | "jekyll"
  | "gatsby"
  | "eleventy"
  | "sveltekit"
  | "unknown";

export type FrontmatterFormat = "yaml" | "toml";

export type DetectedField = {
  name: string;
  type: FrontmatterFieldType;
  required: boolean;
  defaultValue: string;
  options: string;
};

export type ConfigFile = {
  path: string;
  content: string;
};

export type RawSampleFile = {
  path: string;
  content: string;
};

export type DetectionBasis =
  | "framework-config"
  | "samples"
  | "mixed"
  | "heuristic"
  | "none";

export type DetectionResult = {
  fields: DetectedField[];
  framework: DetectionFramework;
  frontmatterFormat: FrontmatterFormat;
  sources: string[];
  sampledCount: number;
  basis: DetectionBasis;
};

export type ConfigField = {
  type: FrontmatterFieldType;
  required: boolean;
  options: string;
};

export type ConfigSchema = Map<string, ConfigField>;
