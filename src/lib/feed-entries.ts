import { SITE_URL } from "@/lib/seo";

/**
 * Entries surfaced in the public RSS feed at `/rss.xml`. This is the
 * single source of truth — add a new object at the top of `FEED_ENTRIES`
 * whenever a noteworthy product update ships and the feed will pick it
 * up on the next build.
 *
 * Keep entries sorted newest-first; consumers expect that order and the
 * generator does not sort.
 */

export type FeedEntry = {
  /** Stable, URL-safe identifier. Used as the RSS `<guid>`. */
  id: string;
  title: string;
  /** ISO 8601 timestamp. */
  date: string;
  /** Absolute or site-relative URL. */
  url: string;
  /** Short plain-text summary shown in feed readers. */
  description: string;
};

export const FEED_ENTRIES: readonly FeedEntry[] = [
  {
    id: "byok-ai-providers-2026-05",
    title: "Bring-your-own-key AI providers",
    date: "2026-05-13T00:00:00Z",
    url: `${SITE_URL}/`,
    description:
      "Anthropic, OpenAI, and OpenRouter keys are now supplied per project and stored encrypted in WorkOS Vault. You pay providers directly; Wryte never proxies your usage.",
  },
  {
    id: "per-project-media-providers-2026-05",
    title: "Per-project media providers and credential vault",
    date: "2026-05-10T00:00:00Z",
    url: `${SITE_URL}/`,
    description:
      "UploadThing and Cloudinary credentials now live per project and are encrypted with a vault-backed self-destruct flow on project deletion.",
  },
  {
    id: "favorites-section-2026-05",
    title: "New Favorites section",
    date: "2026-05-05T00:00:00Z",
    url: `${SITE_URL}/`,
    description:
      "Pin frequently-used projects to a Favorites section in the sidebar for one-click access.",
  },
  {
    id: "launch-2026-05",
    title: "Wryte is live",
    date: "2026-05-01T00:00:00Z",
    url: SITE_URL,
    description:
      "An editor-first content workflow tool for developers. Capture rough ideas, refine them with AI, and publish to GitHub when ready.",
  },
];
