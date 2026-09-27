import type { DetectionFramework } from "./types";

export function identifyFramework(allPaths: string[]): DetectionFramework {
  const set = new Set(allPaths);
  const has = (p: string) => set.has(p);
  const hasPrefix = (prefix: string) =>
    allPaths.some((p) => p === prefix || p.startsWith(`${prefix}/`));
  const hasAny = (...candidates: string[]) => candidates.some(has);

  if (
    hasAny(
      "astro.config.mjs",
      "astro.config.ts",
      "astro.config.js",
      "astro.config.cjs",
    )
  ) {
    return "astro";
  }

  if (
    hasAny("hugo.toml", "hugo.yaml", "hugo.yml", "hugo.json") ||
    hasAny("config.toml") ||
    hasPrefix("archetypes") ||
    hasPrefix("config/_default")
  ) {
    return "hugo";
  }

  if (hasAny("gatsby-config.js", "gatsby-config.ts")) return "gatsby";

  if (
    hasAny(
      ".eleventy.js",
      "eleventy.config.js",
      "eleventy.config.cjs",
      "eleventy.config.mjs",
    )
  ) {
    return "eleventy";
  }

  if (hasAny("svelte.config.js", "svelte.config.ts")) return "sveltekit";

  if (
    has("_config.yml") &&
    (hasPrefix("_posts") || hasPrefix("_layouts") || has("Gemfile"))
  ) {
    return "jekyll";
  }

  if (
    hasAny(
      "next.config.js",
      "next.config.ts",
      "next.config.mjs",
      "next.config.cjs",
    )
  ) {
    return "nextjs";
  }

  return "unknown";
}

export function configCandidatePaths(framework: DetectionFramework): string[] {
  switch (framework) {
    case "astro":
      return [
        "src/content.config.ts",
        "src/content/config.ts",
        "src/content.config.js",
        "src/content/config.js",
        "src/content.config.mjs",
        "src/content/config.mjs",
      ];
    case "nextjs":
      return ["contentlayer.config.ts", "contentlayer.config.js"];
    case "hugo":
      return [
        "archetypes/default.md",
        "hugo.toml",
        "hugo.yaml",
        "hugo.yml",
        "config.toml",
        "config/_default/hugo.toml",
        "config/_default/config.toml",
      ];
    case "jekyll":
      return ["_config.yml"];
    default:
      return [];
  }
}
