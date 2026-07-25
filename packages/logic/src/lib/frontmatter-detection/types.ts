import type { FrontmatterFieldType } from "@wryte/logic/types/frontmatter";

/** Static-site frameworks we can detect and parse config for. */
export type DetectionFramework =
  | "astro"
  | "nextjs"
  | "hugo"
  | "jekyll"
  | "gatsby"
  | "eleventy"
  | "sveltekit"
  | "unknown";

/** Frontmatter delimiter style observed in a repo's content. */
export type FrontmatterFormat = "yaml" | "toml";

/**
 * A single detected field. Mirrors the editor's `FrontmatterField` shape
 * (name/type/required/defaultValue/options) so the wizard can consume it
 * directly. `defaultValue` is always "" — detection learns a schema's *shape*,
 * never copies a sampled post's per-post values.
 */
export type DetectedField = {
  name: string;
  type: FrontmatterFieldType;
  required: boolean;
  defaultValue: string;
  options: string;
};

/** A framework config file fetched from the repo (e.g. Astro content config). */
export type ConfigFile = {
  path: string;
  content: string;
};

/** A raw markdown/MDX post fetched from the repo, before frontmatter parsing. */
export type RawSampleFile = {
  path: string;
  content: string;
};

/** Where a field's type primarily came from — useful for UI + debugging. */
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
  /** Config + sampled files that informed the result. */
  sources: string[];
  /** Number of posts whose frontmatter was successfully parsed. */
  sampledCount: number;
  basis: DetectionBasis;
};

/**
 * Output of a framework config parser: an authoritative field map plus the
 * options string for enum/select fields. `required` is the framework's own
 * declaration (e.g. Astro's absence of `.optional()`).
 */
export type ConfigField = {
  type: FrontmatterFieldType;
  required: boolean;
  options: string;
};

export type ConfigSchema = Map<string, ConfigField>;
