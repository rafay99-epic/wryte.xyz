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

export const PUBLIC_ROUTES = [
  { path: "/", changeFrequency: "weekly", priority: 1.0 },
  { path: "/how-it-works", changeFrequency: "monthly", priority: 0.8 },
  { path: "/docs", changeFrequency: "monthly", priority: 0.7 },
  { path: "/changelog", changeFrequency: "weekly", priority: 0.6 },
  { path: "/feature-requests", changeFrequency: "weekly", priority: 0.5 },
  { path: "/contact", changeFrequency: "yearly", priority: 0.4 },
  { path: "/privacy", changeFrequency: "yearly", priority: 0.3 },
  { path: "/terms", changeFrequency: "yearly", priority: 0.3 },
] as const;

export const APP_ROUTE_PREFIXES = [
  "/dashboard",
  "/articles",
  "/calendar",
  "/editor",
  "/projects",
  "/settings",
  "/admin",
] as const;

export const AUTH_ROUTE_PREFIXES = ["/sign-in", "/sign-up"] as const;

export const PRIVATE_ROUTE_PATTERNS = [
  ...[...APP_ROUTE_PREFIXES, ...AUTH_ROUTE_PREFIXES].flatMap((prefix) => [
    prefix,
    `${prefix}/*`,
  ]),
  "/api/*",
];

export const LLM_BOTS = [
  "GPTBot",
  "ChatGPT-User",
  "OAI-SearchBot",
  "ClaudeBot",
  "Claude-Web",
  "Claude-SearchBot",
  "anthropic-ai",
  "Google-Extended",
  "GoogleOther",
  "PerplexityBot",
  "Perplexity-User",
  "Applebot-Extended",
  "Meta-ExternalAgent",
  "Meta-ExternalFetcher",
  "Bytespider",
  "Amazonbot",
  "cohere-ai",
  "DuckAssistBot",
  "YouBot",
  "Diffbot",
  "MistralAI-User",
] as const;

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
