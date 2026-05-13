/**
 * Shared SEO constants used across metadata, robots, sitemap, RSS, and
 * llms.txt. Keep this file the single source of truth — any change here
 * propagates to every generated discovery artifact.
 */

export const SITE_URL = "https://wryte.xyz";
export const SITE_NAME = "Wryte";
export const SITE_TITLE = "Wryte – Write Now, Publish Later";
export const SITE_DESCRIPTION =
  "An editor-first content workflow tool for developers. Capture rough ideas, refine them with AI, and publish to GitHub when ready.";
export const SITE_LOCALE = "en-US";
export const SITE_AUTHOR = "Abdul Rafay";
export const SITE_AUTHOR_URL = "https://rafay99.com";
export const SITE_TWITTER = "@rafay99-epic";
export const SITE_GITHUB = "https://github.com/rafay99-epic/wryte.xyz";

/** Public, indexable routes (relative paths). Used by sitemap + llms.txt. */
export const PUBLIC_ROUTES = [
  { path: "/", changeFrequency: "weekly", priority: 1.0 },
  { path: "/privacy", changeFrequency: "yearly", priority: 0.3 },
  { path: "/terms", changeFrequency: "yearly", priority: 0.3 },
] as const;

/** App-only routes that must never be indexed. Used by robots.txt. */
export const PRIVATE_ROUTE_PATTERNS = [
  "/dashboard",
  "/dashboard/*",
  "/editor",
  "/editor/*",
  "/projects",
  "/projects/*",
  "/settings",
  "/settings/*",
  "/sign-in",
  "/sign-in/*",
  "/sign-up",
  "/sign-up/*",
  "/api/*",
] as const;

/**
 * LLM / AI-training crawlers we explicitly allow. Listing them by name (vs
 * relying on the wildcard fallback) makes the policy auditable and lets
 * future-us tighten or relax per-bot rules without touching the wildcard.
 */
export const LLM_BOTS = [
  "GPTBot", // OpenAI training crawler
  "ChatGPT-User", // OpenAI on-demand fetch (user-initiated)
  "OAI-SearchBot", // OpenAI search index
  "ClaudeBot", // Anthropic training crawler
  "Claude-Web", // Anthropic on-demand fetch
  "Claude-SearchBot", // Anthropic search index
  "anthropic-ai", // Legacy Anthropic UA
  "Google-Extended", // Google Gemini training
  "GoogleOther", // Google research crawler
  "PerplexityBot", // Perplexity index
  "Perplexity-User", // Perplexity on-demand fetch
  "Applebot-Extended", // Apple Intelligence training
  "Meta-ExternalAgent", // Meta AI fetch
  "Meta-ExternalFetcher", // Meta AI training
  "Bytespider", // ByteDance / TikTok
  "Amazonbot", // Amazon Alexa / AI
  "cohere-ai", // Cohere
  "DuckAssistBot", // DuckDuckGo AI
  "YouBot", // You.com
  "Diffbot", // Diffbot
  "MistralAI-User", // Mistral on-demand fetch
] as const;

/**
 * Abusive scrapers / SEO tools we block outright to reduce noise and
 * server load. These aren't legitimate search or LLM bots — they're
 * commercial backlink crawlers and content scrapers.
 */
export const BLOCKED_BOTS = [
  "AhrefsBot",
  "SemrushBot",
  "MJ12bot",
  "DotBot",
  "BLEXBot",
  "PetalBot",
  "DataForSeoBot",
] as const;

export function absoluteUrl(path = "/"): string {
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  return `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}
