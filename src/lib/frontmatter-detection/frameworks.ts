import type { DetectionFramework } from "./types";

/**
 * Identifies the static-site framework from a repo's file list (paths relative
 * to the repo root, as returned by the Git Trees API). Order matters: more
 * specific markers are checked first so a Next.js repo that also happens to ship
 * an `_config.yml` isn't misread as Jekyll.
 */
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

  // Jekyll: `_config.yml` is the marker, but corroborate with a Jekyll-specific
  // directory so generic YAML configs in other stacks don't trigger it.
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

/**
 * Candidate repo-relative paths for a framework's authoritative schema config.
 * The route fetches whichever of these exist (filtered against the file tree)
 * and hands the contents to the matching parser. Ordered by preference.
 */
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
