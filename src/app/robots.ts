import type { MetadataRoute } from "next";
import {
  BLOCKED_BOTS,
  LLM_BOTS,
  PRIVATE_ROUTE_PATTERNS,
  SITE_URL,
} from "@/lib/seo";

/**
 * Generates the `/robots.txt` file at build time.
 *
 * Policy:
 *  - All search engines (wildcard) may crawl public pages, never private app routes.
 *  - LLM / AI crawlers are listed explicitly (instead of relying on the
 *    wildcard) so the policy is auditable and we can tighten per-bot rules
 *    later without affecting search engines.
 *  - Abusive backlink / SEO scrapers are blocked outright.
 *  - Sitemap and host hints help discovery for compliant crawlers.
 */
export default function robots(): MetadataRoute.Robots {
  const disallow = [...PRIVATE_ROUTE_PATTERNS];

  return {
    rules: [
      { userAgent: "*", allow: "/", disallow },
      ...LLM_BOTS.map((userAgent) => ({
        userAgent,
        allow: "/",
        disallow,
      })),
      ...BLOCKED_BOTS.map((userAgent) => ({
        userAgent,
        disallow: "/",
      })),
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
